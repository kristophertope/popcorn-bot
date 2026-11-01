# Popcorn Alert

A Shelly Plug US Gen4 (model S4PL-00116US) powers the office popcorn maker. A script on the plug watches power draw and posts a Slack message when someone starts making popcorn.

## Current state

- Plug is on the local network at `http://192.168.0.67` (override with `SHELLY_HOST`)
- Slack incoming webhook URL is in `.env` as `SLACK_WEBHOOK_URL` (gitignored, never commit it)
- `THRESHOLD_W` in `popcorn-alert.js` is `3` for testing with a lamp (lamp reads 0.0 W off, 6.4 W on)

## How the script works

- Listens for `switch:0` status changes via `Shelly.addStatusHandler`
- When `apower` crosses above `THRESHOLD_W`, it POSTs to Slack (5-minute cooldown between alerts)
- Reads the webhook URL from the plug's KVS store (key `slack_webhook`) so the URL stays out of the code

## Deploying

Deploy by hand in the plug's web UI at `http://192.168.0.67`:

1. Under Advanced → KVS, add key `slack_webhook` with the URL from `.env`.
2. Under Scripts, create a script named `popcorn-alert`, paste in `popcorn-alert.js`, save, enable run on startup, and start it.
3. Under Settings for the output, set power-on default to on so the plug comes back after outages.

After any change to `popcorn-alert.js`, paste the new code into the script and restart it.

## Remaining tasks

1. **Test with the lamp:** turn it on and confirm the Slack message arrives. Check logs via the web UI Scripts console or `Script.GetStatus`.
2. **At the office:** plug in the popcorn maker, read `apower` from `http://192.168.0.67/rpc/Switch.GetStatus?id=0` idle and running, set `THRESHOLD_W` comfortably between the two, and redeploy.

## References

- Device API: https://shelly-api-docs.shelly.cloud/gen2/Devices/Gen4/ShellyPlugUSG4
- Switch component: https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch
- Script component: https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Script
- KVS component: https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/KVS
