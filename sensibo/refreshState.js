const unified = require('./unified')

module.exports = (platform) => {
	return () => {
		if (!platform.processingState && !platform.setProcessing) {
			platform.processingState = true
			clearTimeout(platform.pollingTimeout)
			setTimeout(async () => {
				try {
					platform.devices = await platform.sensiboApi.getAllDevices()
					await platform.storage.setItem('devices', platform.devices)
				} catch(err) {
					platform.log.easyDebug('<<<< ---- Refresh State FAILED! ---- >>>>')
					platform.processingState = false
					if (platform.pollingInterval) {
						platform.log.easyDebug(`Will try again in ${platform.pollingInterval/1000} seconds...`)
						platform.pollingTimeout = setTimeout(platform.refreshState, platform.pollingInterval)
					}

					return
				}
				if (platform.setProcessing) {
					platform.processingState = false

					return
				}

				const handledLocations = []

				platform.devices.forEach(device => {
					const airConditioner = platform.activeAccessories.find(accessory => {
						return accessory.type === 'AirConditioner' && accessory.id === device.id
					})

					if (airConditioner) {
						// Update AC state in cache + HomeKit
						airConditioner.state.update(unified.acState(device))

						// Update Climate React Switch state in HomeKit
						const climateReactSwitch = platform.activeAccessories.find(accessory => {
							return accessory.type === 'ClimateReact' && accessory.id === device.id
						})

						if (climateReactSwitch) {
							climateReactSwitch.updateHomeKit()
						}
					}

					const airPurifier = platform.activeAccessories.find(accessory => {
						return accessory.type === 'AirPurifier' && accessory.id === device.id
					})

					// Update Pure state in cache + HomeKit
					if (airPurifier) {
						airPurifier.state.update(unified.acState(device))
					}

					const airQualitySensor = platform.activeAccessories.find(accessory => {
						return accessory.type === 'AirQualitySensor' && accessory.id === device.id
					})

					// Update Air Quality Sensor state in cache + HomeKit
					if (airQualitySensor) {
						// FIXME: need a better way to get constants in to the airQualityState function
						const Constants = {
							VOCDENSITY_MAX: platform.VOCDENSITY_MAX,
							carbonDioxideAlertThreshold: platform.carbonDioxideAlertThreshold
						}

						airQualitySensor.state.update(unified.airQualityState(device, Constants))
					}

					// Update Humidity Sensor state in HomeKit
					const humiditySensor = platform.activeAccessories.find(accessory => {
						return accessory.type === 'HumiditySensor' && accessory.id === device.id
					})

					if (humiditySensor) {
						humiditySensor.updateHomeKit()
					}

					// Update Room Sensor state in cache + HomeKit
					if (device.motionSensors && Array.isArray(device.motionSensors)) {
						device.motionSensors.forEach(sensor => {
							const roomSensor = platform.activeAccessories.find(accessory => {
								return accessory.type === 'RoomSensor' && accessory.id === sensor.id
							})

							if (roomSensor) {
								roomSensor.state.update(unified.sensorState(sensor))
							}
						})
					}

					// Update Occupancy state in cache + HomeKit
					const location = platform.activeAccessories.find(accessory => {
						return accessory.type === 'OccupancySensor' && accessory.id === device.location.id
					})

					if (location && !handledLocations.includes(location.id)) {
						handledLocations.push(location.id)
						location.state.update(unified.occupancyState(device.location))
					}
				})

				// register new devices / unregister removed devices
				platform.syncHomeKitCache()

				// start timeout for next polling
				if (platform.pollingInterval) {
					platform.pollingTimeout = setTimeout(platform.refreshState, platform.pollingInterval)
				}

				// block new requests for extra 5 seconds
				setTimeout(() => {
					platform.processingState = false
				}, platform.refreshDelay)
			}, platform.refreshDelay)
		}
	}
}