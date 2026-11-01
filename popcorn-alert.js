let THRESHOLD_W = 3;
let COOLDOWN_S = 300;
let SWITCH_ID = 0;

let webhook = null;
let lastAlertAt = -COOLDOWN_S;
let running = false;

function uptime() {
  return Shelly.getComponentStatus("sys").uptime;
}

function loadWebhook() {
  Shelly.call("KVS.Get", { key: "slack_webhook" }, function (res, errCode, errMsg) {
    if (errCode !== 0 || !res || !res.value) {
      print("popcorn-alert: slack_webhook missing from KVS: " + errMsg);
      return;
    }
    webhook = res.value;
    print("popcorn-alert: webhook loaded");
  });
}

function postToSlack(watts) {
  if (!webhook) {
    print("popcorn-alert: no webhook, skipping alert");
    return;
  }
  let body = JSON.stringify({ text: ":popcorn: Someone is making popcorn! (" + watts + " W)" });
  Shelly.call(
    "HTTP.POST",
    { url: webhook, body: body, content_type: "application/json", timeout: 10 },
    function (res, errCode, errMsg) {
      if (errCode !== 0) {
        print("popcorn-alert: Slack POST failed: " + errMsg);
        return;
      }
      print("popcorn-alert: Slack responded " + res.code);
    }
  );
}

function onPopcornStarted(watts) {
  let now = uptime();
  if (now - lastAlertAt < COOLDOWN_S) {
    print("popcorn-alert: in cooldown, skipping alert");
    return;
  }
  lastAlertAt = now;
  postToSlack(watts);
}

Shelly.addStatusHandler(function (event) {
  if (event.component !== "switch:" + SWITCH_ID) return;
  if (!event.delta || typeof event.delta.apower === "undefined") return;
  let watts = event.delta.apower;
  let nowRunning = watts > THRESHOLD_W;
  if (nowRunning && !running) onPopcornStarted(watts);
  running = nowRunning;
});

loadWebhook();
print("popcorn-alert: watching switch:" + SWITCH_ID + " above " + THRESHOLD_W + " W");
