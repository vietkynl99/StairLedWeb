/**
 * Bluetooth Terminal class.
 */
class BluetoothTerminal {
  /**
   * Create preconfigured Bluetooth Terminal instance.
   * @param {!(number|string)} [serviceUuid=0xFFE0] - Service UUID
   * @param {string} [receiveSeparator='\n'] - Receive separator
   * @param {string} [sendSeparator='\n'] - Send separator
   */
  constructor(deviceName = null, serviceUuid = '', receiveSeparator = '\n', sendSeparator = '\n') {
    // Used private variables.
    this._deviceName = deviceName;
    this._serviceUuid = serviceUuid;
    this._receiveSeparator = receiveSeparator;
    this._sendSeparator = sendSeparator;

    this._receiveBuffer = ''; // Buffer containing not separated data.
    this._maxCharacteristicValueLength = 20; // Max characteristic value length.
    this._device = null; // Device object cache.
    this._txCharacteristic = null; // Tx characteristic object cache.
    this._rxCharacteristic = null; // Rx characteristic object cache.

    // Bound functions used to add and remove appropriate event handlers.
    this._boundHandleDisconnection = this._handleDisconnection.bind(this);
    this._boundHandleCharacteristicValueChanged = this._handleCharacteristicValueChanged.bind(this);
  }

  /**
   * Launch Bluetooth device chooser and connect to the selected device.
   * @return {Promise} Promise which will be fulfilled when notifications will
   *                   be started or rejected if something went wrong
   */
  connect() {
    return this._connectToDevice(this._device);
  }

  /**
   * Disconnect from the connected device.
   */
  disconnect() {
    this._disconnectFromDevice(this._device);

    if (this._characteristic) {
      this._characteristic.removeEventListener('characteristicvaluechanged',
        this._boundHandleCharacteristicValueChanged);
      this._characteristic = null;
    }

    this._device = null;
  }

  /**
   * Data receiving handler which called whenever the new data comes from
   * the connected device, override it to handle incoming data.
   * @param {string} data - Data
   */
  receive(data) {
    // Handle incoming data.
  }

  /**
   * Send data to the connected device.
   * @param {string} data - Data
   * @return {Promise} Promise which will be fulfilled when data will be sent or
   *                   rejected if something went wrong
   */
  send(data) {
    // Convert data to the string using global object.
    data = String(data || '');

    // Return rejected promise immediately if data is empty.
    if (!data) {
      return Promise.reject(new Error('Data must be not empty'));
    }

    data += this._sendSeparator;

    // Split data to chunks by max characteristic value length.
    const chunks = this.constructor._splitByLength(data,
      this._maxCharacteristicValueLength);

    // Return rejected promise immediately if there is no connected device.
    if (!this._txCharacteristic) {
      return Promise.reject(new Error('There is no connected device'));
    }

    // Write first chunk to the characteristic immediately.
    let promise = this._writeToCharacteristic(this._txCharacteristic, chunks[0]);

    // Iterate over chunks if there are more than one of it.
    for (let i = 1; i < chunks.length; i++) {
      // Chain new promise.
      promise = promise.then(() => new Promise((resolve, reject) => {
        // Reject promise if the device has been disconnected.
        if (!this._txCharacteristic) {
          reject(new Error('Device has been disconnected'));
        }

        // Write chunk to the characteristic and resolve the promise.
        this._writeToCharacteristic(this._txCharacteristic, chunks[i]).
          then(resolve).
          catch(reject);
      }));
    }

    return promise;
  }

  /**
   * Get the connected device name.
   * @return {string} Device name or empty string if not connected
   */
  getDeviceName() {
    if (!this._device) {
      return '';
    }

    return this._device.name;
  }

  /**
   * Connect to device.
   * @param {Object} device
   * @return {Promise}
   * @private
   */
  _connectToDevice(device) {
    return (device ? Promise.resolve(device) : this._requestBluetoothDevice()).
      then((device) => this._connectCharacteristics(device)).
      catch((error) => {
        this._log(error);
        return Promise.reject(error);
      });
  }

  /**
   * Disconnect from device.
   * @param {Object} device
   * @private
   */
  _disconnectFromDevice(device) {
    if (!device) {
      return;
    }

    this._log('Disconnecting from "' + device.name + '" bluetooth device...');

    device.removeEventListener('gattserverdisconnected',
      this._boundHandleDisconnection);

    if (!device.gatt.connected) {
      this._log('"' + device.name +
        '" bluetooth device is already disconnected');
      return;
    }

    device.gatt.disconnect();

    this._log('"' + device.name + '" bluetooth device disconnected');
  }

  /**
   * Request bluetooth device.
   * @return {Promise}
   * @private
   */
  _requestBluetoothDevice() {
    this._log('Requesting bluetooth device...');

    let filter = {};
    if (this._deviceName) {
      filter.name = this._deviceName;
    }
    if (this._serviceUuid) {
      filter.services = this._serviceUuid;
    }

    return navigator.bluetooth.requestDevice({
      filters: [filter],
    }).
      then((device) => {
        this._log('"' + device.name + '" bluetooth device selected');

        this._device = device; // Remember device.
        this._device.addEventListener('gattserverdisconnected',
          this._boundHandleDisconnection);

        return this._device;
      });
  }

  /**
   * Connect device and cache characteristic.
   * @param {Object} device
   * @return {Promise}
   * @private
   */
  _connectCharacteristics(device) {
    // Check remembered characteristic.
    if (device.gatt.connected && this._characteristic) {
      return Promise.resolve(this._characteristic);
    }

    this._log('Connecting to GATT server...')

    return device.gatt.connect().
      then((server) => {
        this._log('GATT server connected')
        return server.getPrimaryServices()
      }).
      then((services) => {
        this._log(`Found ${services.length} services`)
        const service = services[0]
        this._serviceUuid = service.uuid
        this._log(`Service UUID: ${service.uuid}`)
        return service.getCharacteristics();
      }).
      then((characteristics) => {
        this._log(`Found ${characteristics.length} characteristics`)
        characteristics.sort((a, b) => a.uuid.localeCompare(b.uuid))
        characteristics.forEach(characteristic => {
          console.log(`Characteristic UUID: ${characteristic.uuid}`)
        })

        if (characteristics.length !== 2) {
          reject(new Error('Characteristics size is invalid'));
        }
        this._txCharacteristic = characteristics[0]
        this._rxCharacteristic = characteristics[1]
        return this._rxCharacteristic.startNotifications()
      }).
      then(() => {
        this._log('Notifications started');
        this._rxCharacteristic.addEventListener('characteristicvaluechanged',
          this._boundHandleCharacteristicValueChanged);
      }
      )
  }

  /**
   * Stop notifications.
   * @param {Object} characteristic
   * @return {Promise}
   * @private
   */
  _stopNotifications(characteristic) {
    this._log('Stopping notifications...');

    return characteristic.stopNotifications().
      then(() => {
        this._log('Notifications stopped');

        characteristic.removeEventListener('characteristicvaluechanged',
          this._boundHandleCharacteristicValueChanged);
      });
  }

  /**
   * Handle disconnection.
   * @param {Object} event
   * @private
   */
  _handleDisconnection(event) {
    const device = event.target;

    this._log('"' + device.name +
      '" bluetooth device disconnected, trying to reconnect...');

    this._connectCharacteristics(device).
      catch((error) => this._log(error));
  }

  /**
   * Handle characteristic value changed.
   * @param {Object} event
   * @private
   */
  _handleCharacteristicValueChanged(event) {
    const value = new TextDecoder().decode(event.target.value);

    for (const c of value) {
      if (c === this._receiveSeparator) {
        const data = this._receiveBuffer.trim();
        this._receiveBuffer = '';

        if (data) {
          this.receive(data);
        }
      } else {
        this._receiveBuffer += c;
      }
    }
  }

  /**
   * Write to characteristic.
   * @param {Object} characteristic
   * @param {string} data
   * @return {Promise}
   * @private
   */
  _writeToCharacteristic(characteristic, data) {
    return characteristic.writeValue(new TextEncoder().encode(data));
  }

  /**
   * Log.
   * @param {Array} messages
   * @private
   */
  _log(...messages) {
    console.log(...messages); // eslint-disable-line no-console
  }

  /**
   * Split by length.
   * @param {string} string
   * @param {number} length
   * @return {Array}
   * @private
   */
  static _splitByLength(string, length) {
    return string.match(new RegExp('(.|[\r\n]){1,' + length + '}', 'g'));
  }
}

// Export class as a module to support requiring.
/* istanbul ignore next */
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = BluetoothTerminal;
}
