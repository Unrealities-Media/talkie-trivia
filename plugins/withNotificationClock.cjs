const { withDangerousMod } = require("expo/config-plugins")
const { prepareNotificationClock } = require("../scripts/prepare-notification-clock.cjs")

module.exports = config => withDangerousMod(config, ["android", mod => {
  prepareNotificationClock(mod.modRequest.projectRoot)
  return mod
}])
