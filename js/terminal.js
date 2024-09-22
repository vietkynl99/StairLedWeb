// Client -> Server
const BLE_CMD_SEND_CMD = 100;
const BLE_CMD_LOAD_SETTING = 101;
const BLE_CMD_RESTORE_SETTING = 102;
const BLE_CMD_OTA_PREPARE = 103;
const BLE_CMD_OTA_SEND_FILE = 104;

// Server -> Client
const BLE_CMD_RESP_CMD = 150;
const BLE_CMD_LOG = 151;
const BLE_CMD_RESP_SETTING = 152;
const BLE_CMD_OTA_PREPARE_DONE = 153;
const BLE_CMD_OTA_PROGRESS = 154;
const BLE_CMD_OTA_FAILED = 155;
const BLE_CMD_OTA_SUCCESS = 156;

let cachedOTAFile = null;

const toggleConnectionBtn = document.getElementById('toggleConnectionBtn')
const chatInput = document.getElementById('chatInput')

const terminal = new BluetoothTerminal('Stair Led', '013052ff-8771-46a9-89f8-eedbedd76935')

terminal.setMtuSize(128);

function log(message, type = 'debug') {
    console.log(message)
    if (type == 'error') {
        addToChat(message, 'red')
        showNotification(message, 'error');
    }
    else {
        addToChat(message, 'black')
    }
}

function sendCommand(command, data = null, onProgress = null) {
    if (!terminal.isConnected()) {
        showNotification('Thiết bị chưa được kết nối', 'error');
        return;
    }
    let info = 'send command ' + command;
    if (data) {
        info += ', size ' + data.length;
    }
    console.log(info);

    terminal.setFastMode(command == BLE_CMD_OTA_SEND_FILE);
    terminal.sendCommand(command, data, onProgress).
        catch((error) => log(error, 'error'));
}

function sendCommandLine(commandName, value) {
    const message = commandName + ' ' + value
    addToChat(message, 'blue');
    sendCommand(BLE_CMD_SEND_CMD, message);
};

function loadSettings() {
    sendCommand(BLE_CMD_LOAD_SETTING);
}

function resetToDefault() {
    sendCommand(BLE_CMD_RESTORE_SETTING);
    setTimeout(() => {
        sendCommand(BLE_CMD_LOAD_SETTING);
    }, 500);
}

terminal.receive = (command, data) => {
    // console.log('Received command:', command);
    switch (command) {
        case BLE_CMD_RESP_CMD:
        case BLE_CMD_LOG:
            {
                const message = new TextDecoder().decode(data).trim();
                addToChat(message, 'green');
                break;
            }
        case BLE_CMD_RESP_SETTING:
            {
                const message = new TextDecoder().decode(data).trim();
                try {
                    const settings = JSON.parse(message);
                    console.log('settings: ', settings);
                    loadSettingsToUI(settings);
                } catch (error) {
                    console.error(message, ' -> ', error);
                }
                break;
            }
        case BLE_CMD_OTA_PREPARE_DONE:
            {
                if (cachedOTAFile) {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const arrayBuffer = e.target.result;
                        const uint8Array = new Uint8Array(arrayBuffer);
                        sendCommand(BLE_CMD_OTA_SEND_FILE, uint8Array);
                    };
                    reader.readAsArrayBuffer(cachedOTAFile);
                }
                break;
            }
        case BLE_CMD_OTA_PROGRESS:
            {
                const message = new TextDecoder().decode(data).trim();
                const parts = message.split(' ');
                if (parts.length == 2) {
                    document.getElementById('uploadBtn').innerText = `Updating ${parts[0]}% (${parts[1]}KB/s)`;
                }
                break;
            }
        case BLE_CMD_OTA_FAILED:
            {
                const message = new TextDecoder().decode(data).trim();
                log('Cập nhật OTA thất bại: ' + message, 'error')
                document.getElementById('uploadBtn').innerText = 'Update';
                break;
            }
        case BLE_CMD_OTA_SUCCESS:
            {
                log('Cập nhật OTA thành công')
                showNotification('Cập nhật OTA thành công', 'success');
                document.getElementById('uploadBtn').innerText = 'Update';
                break;
            }
        default:
            console.warn('Unhandled command: ' + command);
            break;
    }
}

terminal._log = log

terminal.onConnectionChanged = function (connected) {
    log('Connection changed to ' + connected)
    setBluetoothIcon(terminal.isConnected())
    document.getElementById('uploadBtn').innerText = 'Update';
    if (connected) {
        loadSettings();
    }
}

toggleConnectionBtn.addEventListener('click', () => {
    terminal.connect().
        catch((error) => log(error, 'error'))
})

chatInput.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        const message = chatInput.value.trim()
        if (message) {
            addToChat(message, 'blue');
            sendCommand(BLE_CMD_SEND_CMD, message);

            chatInput.value = ''
        }
    }
})

const idList = ['stairMode',
    'brightness',
    'fadeTime',
    'intervalTime',
    'manualWaitTime',
    'autoWaitTime',
    'timerOnTime',
    'timerOffTime',
    'sensorSens1',
    'sensorSens2'];
const cmdNameList = ['set-stair-mode',
    'set-brightness-percent',
    'set-fade-time',
    'set-interval-time',
    'set-manual-wait-time',
    'set-auto-wait-time',
    'set-timer-on-time',
    'set-timer-off-time',
    'set-sensor-sensitivity 0',
    'set-sensor-sensitivity 1'];

for (let i = 0; i < idList.length; i++) {
    document.getElementById(idList[i]).addEventListener('change', function (event) {
        sendCommandLine(cmdNameList[i], event.target.value);
    });
}

document.getElementById('enableTimer').addEventListener('change', function (event) {
    sendCommandLine('set-enable-timer', event.target.checked ? 1 : 0);
});

document.getElementById('uploadBtn').addEventListener('click', function () {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();

        reader.onload = function (e) {
            const arrayBuffer = e.target.result;
            const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
            const md5Hash = CryptoJS.MD5(wordArray).toString(CryptoJS.enc.Hex);

            const info = {
                name: file.name,
                size: file.size,
                md5: md5Hash,
            };
            const message = JSON.stringify(info);
            console.log('Prepare OTA:', message);
            sendCommand(BLE_CMD_OTA_PREPARE, message);
            cachedOTAFile = file;
        };

        reader.readAsArrayBuffer(file);
    }
});