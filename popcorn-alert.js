let THRESHOLD_W = 400;
let COOLDOWN_S = 900;
let MIN_RUN_S = 60;
let SWITCH_ID = 0;

let webhook = null;
let lastStartAlertAt = -COOLDOWN_S;
let previousStartAlertAt = -COOLDOWN_S;
let lastReadyAlertAt = -COOLDOWN_S;
let running = false;
let startedAt = 0;

function uptime() {
  return Shelly.getComponentStatus("sys").uptime;
}

function postToSlack(text) {
  print("popcorn-alert: would post: " + text);
  if (!webhook) {
    print("popcorn-alert: no webhook, skipping alert");
    return;
  }
  Shelly.call(
    "HTTP.POST",
    { url: webhook, body: JSON.stringify({ text: text }), content_type: "application/json", timeout: 10 },
    function (res, errCode, errMsg) {
      if (errCode !== 0) {
        print("popcorn-alert: Slack POST failed: " + errMsg);
        return;
      }
      print("popcorn-alert: Slack responded " + res.code);
    }
  );
}

function onPopcornStarted(watts, now) {
  startedAt = now;
  previousStartAlertAt = lastStartAlertAt;
  if (now - lastStartAlertAt < COOLDOWN_S) {
    print("popcorn-alert: start alert in cooldown");
    return;
  }
  lastStartAlertAt = now;
  postToSlack("Someone is making popcorn!");
}

function onPopcornStopped(now) {
  let ranFor = now - startedAt;
  if (ranFor < MIN_RUN_S) {
    print("popcorn-alert: ran " + ranFor + " s, too short for ready alert, clearing start cooldown");
    lastStartAlertAt = previousStartAlertAt;
    return;
  }
  if (now - lastReadyAlertAt < COOLDOWN_S) {
    print("popcorn-alert: ready alert in cooldown");
    return;
  }
  lastReadyAlertAt = now;
  postToSlack("Popcorn is ready!");
}

Shelly.addStatusHandler(function (event) {
  if (event.component !== "switch:" + SWITCH_ID) return;
  if (!event.delta || typeof event.delta.apower === "undefined") return;
  let watts = event.delta.apower;
  let nowRunning = watts > THRESHOLD_W;
  if (nowRunning && !running) onPopcornStarted(watts, uptime());
  if (!nowRunning && running) onPopcornStopped(uptime());
  running = nowRunning;
});

print("popcorn-alert: watching switch:" + SWITCH_ID + " above " + THRESHOLD_W + " W");
