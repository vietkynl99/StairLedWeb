const BLE_CMD_START_BYTE = 0xC0;

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
  constructor(deviceName, serviceUuid, receiveSeparator = '\n', sendSeparator = '\n') {
    // Used private variables.
    this._deviceName = deviceName;
    this._serviceUuid = serviceUuid;
    this._receiveSeparator = receiveSeparator;
    this._sendSeparator = sendSeparator;

    this._debug = false;
    this._fastMode = false;
    this._connected = false;
    this._mtuSize = 23; // Max characteristic value length.
    this._receiveTimeout = 10000; // Receive timeout
    this._device = null; // Device object cache.
    this._characteristic = null; // Characteristic object cache.
    this._resetReceiveBuffer();

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
   * 
   * @returns {boolean} Connection state
   */
  isConnected() {
    return this._connected;
  }

  /**
   * 
   * @returns {size} MTU size
   */
  getMtuSize() {
    return this._mtuSize;
  }

  /**
   * 
   * @param {size} size 
   */
  setMtuSize(size) {
    this._mtuSize = size;
  }

  /**
   * 
   * @param {boolean} fastMode 
   */
  setFastMode(fastMode) {
    this._fastMode = fastMode;
  }

  /**
   * 
   * @param {boolean} connected 
   */
  onConnectionChanged(connected) {
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
   * Data receiving handler which called whenever the new data comes from
   * the connected device, override it to handle incoming data.
   * @param {number} command - Command
   * @param {Uint8Array} data - Data
   */
  receive(command, data) {
    // Handle incoming data.
  }

  sendCommand(command, data = null, onProgress = null) {
    const chunkSize = this._mtuSize - 3 - 4;
    const dataSize = data != null ? data.length : 0;
    const bufferSize = dataSize + 6;
    let buffer = new Uint8Array(bufferSize);

    if (this._debug) {
      console.log('sendCommand', command, 'size', dataSize)
    }

    buffer[0] = command;
    buffer[1] = dataSize & 0xFF;
    buffer[2] = (dataSize >> 8) & 0xFF;
    buffer[3] = (dataSize >> 16) & 0xFF;
    buffer[4] = (dataSize >> 24) & 0xFF;
    for (let i = 0; i < dataSize; i++) {
      buffer[5 + i] = (typeof data === 'string') ? data.charCodeAt(i) : data[i];
    }

    let chunks = [];
    let index = 0;
    let crc = 0;
    for (let offset = 0; offset < buffer.byteLength; offset += chunkSize) {
      let chunkIndexArr = new Uint8Array(4);
      chunkIndexArr[0] = index & 0xFF;
      chunkIndexArr[1] = (index >> 8) & 0xFF;
      chunkIndexArr[2] = (index >> 16) & 0xFF;
      chunkIndexArr[3] = (index >> 24) & 0xFF;
      let chunk = new Uint8Array([...chunkIndexArr, ...buffer.slice(offset, offset + chunkSize)]);
      for (let i = 0; i < chunk.length; i++) {
        crc ^= chunk[i];
      }
      if (offset + chunkSize >= buffer.length) {
        chunk[chunk.length - 1] = crc;
      }
      chunks.push(chunk);
      index++;
    }

    return this._send(chunks, onProgress);
  }

  /**
    * Send data to the connected device.
    * @param {Uint8Array} data - Data
    * @return {Promise} Promise which will be fulfilled when data will be sent or
    *                   rejected if something went wrong
    */
  _send(chunks, onProgress = null) {
    // Return rejected promise immediately if data is empty.
    if (!chunks) {
      return Promise.reject(new Error('Data must be not empty'));
    }

    // Return rejected promise immediately if there is no connected device.
    if (!this._connected) {
      return Promise.reject(new Error('There is no connected device'));
    }

    let totalChunks = chunks.length;
    let sentChunks = 0;

    let promise = this._writeToCharacteristic(this._characteristic, chunks[0]).
      then(() => {
        sentChunks++;
        const percent = Math.floor((sentChunks / totalChunks) * 100);
        if (onProgress) onProgress(percent);
      });

    // Iterate over chunks if there are more than one of it.
    for (let i = 1; i < chunks.length; i++) {
      // Chain new promise.
      promise = promise.then(() => new Promise((resolve, reject) => {
        // Reject promise if the device has been disconnected.
        if (!this._characteristic) {
          reject(new Error('Device has been disconnected'));
        }

        // Write chunk to the characteristic and resolve the promise.
        this._writeToCharacteristic(this._characteristic, chunks[i])
          .then(() => {
            sentChunks++;
            const percent = Math.floor((sentChunks / totalChunks) * 100);
            if (onProgress) onProgress(percent);
            resolve();
          })
          .catch(reject);
      }));
    }

    return promise;
  }

  /**
   * 
   * @param {boolean} connected 
   */
  _setConnected(connected) {
    if (this._connected != connected) {
      this._connected = connected;
      this.onConnectionChanged(connected);
    }
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
        this._log(error, 'error');
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

    return navigator.bluetooth.requestDevice({
      filters: [{ name: this._deviceName }],
      optionalServices: [this._serviceUuid],
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
      return Promise.resolve();
    }

    this._log('Connecting to GATT server...')

    return device.gatt.connect().
      then((server) => {
        this._log('GATT server connected')
        return server.getPrimaryService(this._serviceUuid)
      }).
      then((service) => {
        return service.getCharacteristics();
      }).
      then((characteristics) => {
        this._log(`Found ${characteristics.length} characteristics`)
        if (!characteristics.length) {
          reject(new Error('Characteristics size is invalid'));
        }
        this._characteristic = characteristics[0]
        return this._characteristic.startNotifications()
      }).
      then(() => {
        this._log('Notifications started');
        this._characteristic.addEventListener('characteristicvaluechanged',
          this._boundHandleCharacteristicValueChanged);
        this._setConnected(true);
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

    this._setConnected(false);

    this._connectCharacteristics(device).
      catch((error) => this._log(error, 'error'));
  }

  /**
   * Handle characteristic value changed.
   * @param {Object} event
   * @private
   */
  _handleCharacteristicValueChanged(event) {
    const value = event.target.value;
    const data = new Uint8Array(value.buffer);
    const size = data.length;

    if (size < 4) {
      return;
    }

    let index = data[0] | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);


    if (!this._receiveBuffer.isReceiving && size > 9 && index == 0) {
      this._receiveBuffer.command = data[4];
      this._receiveBuffer.dataSize = data[5] | (data[6] << 8) | (data[7] << 16) | (data[8] << 24);
      this._receiveBuffer.chunkIndex = 0;
      this._receiveBuffer.maxChunkIndex = Math.floor((this._receiveBuffer.dataSize + 6) / (this._mtuSize - 7));
      this._receiveBuffer.crc = 0;

      // Recv done
      if (this._receiveBuffer.maxChunkIndex == 0) {
        const dataSize = size - 10; // 10 bytes: index(4), command(1), dataSize(4), CRC(1)
        if (dataSize != this._receiveBuffer.dataSize) {
          console.error('Size error');
          this._resetReceiveBuffer();
          return;
        }
        else {
          this._receiveBuffer.data = new Uint8Array(data.slice(9, dataSize + 9));
          this._receiveBuffer.receivedDataSize = dataSize;
        }
        this._receiveBuffer.isReceiving = false;
      }
      else {
        const dataSize = size - 9; // 9 bytes: index(4), command(1), dataSize(4)
        this._receiveBuffer.data = new Uint8Array(data.slice(9, dataSize + 9));
        this._receiveBuffer.receivedDataSize += dataSize;
        this._receiveBuffer.isReceiving = true;
      }
    }
    else if (this._receiveBuffer.isReceiving) {
      this._receiveBuffer.chunkIndex++;
      if (index != this._receiveBuffer.chunkIndex || index > this._receiveBuffer.maxChunkIndex) {
        console.error('Chunk index exceeds');
        this._resetReceiveBuffer();
        return;
      }

      // 5 bytes: index(4), CRC(1)
      // 4 bytes: index(4)
      const dataSize = index == this._receiveBuffer.maxChunkIndex ? size - 5 : size - 4;
      this._receiveBuffer.data = new Uint8Array([...this._receiveBuffer.data, ...data.slice(4, dataSize + 4)]);
      this._receiveBuffer.receivedDataSize += dataSize;
    }
    else {
      console.error('Unknown error');
      this._resetReceiveBuffer();
      return;
    }

    for (let i = 0; i < size; i++) {
      this._receiveBuffer.crc ^= data[i];
    }

    if (this._receiveBuffer.chunkIndex == this._receiveBuffer.maxChunkIndex) {
      if (this._receiveBuffer.dataSize != this._receiveBuffer.receivedDataSize) {
        console.error('Size error');
        this._resetReceiveBuffer();
        return;
      }
      if (this._receiveBuffer.crc !== 0) {
        console.error('CRC error');
        this._resetReceiveBuffer();
        return;
      }

      let msg = '';
      for (let i = 0; i < this._receiveBuffer.receivedDataSize; i++) {
        msg += this._receiveBuffer.data[i] + '.';
      }
      if (this._debug) {
        console.log('Received command', this._receiveBuffer.command, 'size', this._receiveBuffer.data.length);
      }
      this.receive(this._receiveBuffer.command, this._receiveBuffer.data);
      this._resetReceiveBuffer();
    }
  }

  _resetReceiveBuffer() {
    this._receiveBuffer = {
      isReceiving: false,
      command: 0,
      chunkIndex: 0,
      maxChunkIndex: 0,
      crc: 0,
      data: null,
      dataSize: 0,
      receivedSize: 0,
      receivedDataSize: 0,
      lastTime: new Date().getTime()
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
    if (this._fastMode) {
      return characteristic.writeValueWithoutResponse(data);
    }
    else {
      return characteristic.writeValueWithResponse(data);
    }
  }

  /**
   * Log.
   * @param {Array} messages
   * @private
   */
  _log(message, type = 'debug') {
    console.log(message); // eslint-disable-line no-console
  }
}

// Export class as a module to support requiring.
/* istanbul ignore next */
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = BluetoothTerminal;
}
