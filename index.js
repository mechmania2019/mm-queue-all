const { promisify } = require("util");

const mongoose = require("mongoose");
const authenticate = require("mm-authenticate")(mongoose);
const { Script, Team } = require("mm-schemas")(mongoose);
const { send, buffer } = require("micro");

const amqp = require("amqplib");
const RABBITMQ_URI = process.env.RABBITMQ_URI || "amqp://localhost";
const STANCHION_QUEUE = `stanchionQueue`;

mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set("useCreateIndex", true);
mongoose.Promise = global.Promise;

module.exports = authenticate(async (req, res) => {
  if (!req.user.admin) {
    send(res, 401, "Error: user does not have admin priveleges.");
    return;
  }

  const conn = await amqp.connect(RABBITMQ_URI);
  const ch = await conn.createChannel();
  ch.assertQueue(STANCHION_QUEUE, { durable: true });
  ch.prefetch(1);
  process.on("SIGTERM", async () => {
    console.log("Got SIGTERM");
    await ch.close();
    conn.close();
  });

  console.log("Grabbing all teams...");
  const allTeams = await Team.find().populate("latestScript").exec();

  if (allTeams.length == 0) {
    send(res, 401, "Error: there are no teams to queue games!");
    return;
  }

  console.log("Sending everyone off to stanchion...");

  allTeams.forEach(team => {
    if (team.latestScript) {
      scriptKey = team.latestScript.key;
      console.log(`${scriptKey} - Notifying ${STANCHION_QUEUE}`);
      ch.sendToQueue(STANCHION_QUEUE, Buffer.from(scriptKey), {
        persistent: true
      });
    } else {
      console.log(`There are no logs for ${team}`);
    }
  });

  send(res, 200, "All games queued!");
});
