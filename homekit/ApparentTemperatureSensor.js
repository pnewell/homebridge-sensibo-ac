let Characteristic, Service

class ApparentTemperatureSensor {
	constructor(airConditioner, platform) {

		Service = platform.api.hap.Service
		Characteristic = platform.api.hap.Characteristic
		
		this.log = airConditioner.log
		this.api = airConditioner.api
		this.id = airConditioner.id
		this.model = airConditioner.model + '_apparentTemperature'
		this.serial = airConditioner.serial + '_apparentTemperature'
		this.manufacturer = airConditioner.manufacturer
		this.roomName = airConditioner.roomName
		this.name = this.roomName + ' Apparent Temperature' 
		this.type = 'TemperatureSensor'
		this.displayName = this.name
		this.state = airConditioner.state

		this.stateManager = airConditioner.stateManager

		this.UUID = this.api.hap.uuid.generate(this.id + '_apparentTemperature')
		this.accessory = platform.cachedAccessories.find(accessory => accessory.UUID === this.UUID)

		if (!this.accessory) {
			this.log(`Creating New ${platform.PLATFORM_NAME} ${this.type} Accessory in the ${this.roomName}`)
			this.accessory = new this.api.platformAccessory(this.name, this.UUID)
			this.accessory.context.type = this.type
			this.accessory.context.deviceId = this.id

			platform.cachedAccessories.push(this.accessory)
			// register the accessory
			this.api.registerPlatformAccessories(platform.PLUGIN_NAME, platform.PLATFORM_NAME, [this.accessory])
		}

		if (platform.enableHistoryStorage) {
			const FakeGatoHistoryService = require('fakegato-history')(this.api)
			this.loggingService = new FakeGatoHistoryService('weather', this.accessory, { storage: 'fs', path: platform.persistPath })
		}

		this.accessory.context.roomName = this.roomName

		let informationService = this.accessory.getService(Service.AccessoryInformation)

		if (!informationService)
			informationService = this.accessory.addService(Service.AccessoryInformation)

		informationService
			.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(Characteristic.Model, this.model)
			.setCharacteristic(Characteristic.SerialNumber, this.serial)

		
		this.addApparentTemperatureSensorService()
	}

	addApparentTemperatureSensorService() {
		this.log.easyDebug(`Adding Apparent Temperature Sensor Service in the ${this.roomName}`)
		this.ApparentTemperatureSensorService = this.accessory.getService(Service.TemperatureSensor)
		if (!this.ApparentTemperatureSensorService)
			this.ApparentTemperatureSensorService = this.accessory.addService(Service.TemperatureSensor, this.name, this.type)

		this.ApparentTemperatureSensorService.getCharacteristic(Characteristic.CurrentTemperature)
			.on('get', this.stateManager.get.CurrentApparentTemperature)

  }

	updateHomeKit() {

    
		// log new state with FakeGato
		if (this.loggingService) {
			this.loggingService.addEntry({
				time: Math.floor((new Date()).getTime()/1000),
				apparentTemperature: this.state.apparentTemperature
			})
		}
		
		this.updateValue('ApparentTemperatureSensorService', 'CurrentTemperature', this.state.apparentTemperature)
	}

	updateValue (serviceName, characteristicName, newValue) {
		if (this[serviceName].getCharacteristic(Characteristic[characteristicName]).value !== newValue) {
			this[serviceName].getCharacteristic(Characteristic[characteristicName]).updateValue(newValue)
			this.log.easyDebug(`${this.roomName} - Updated '${characteristicName}' for ${serviceName} with NEW VALUE: ${newValue}`)
		}
	}

	
}


module.exports = ApparentTemperatureSensor
