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

let cachedOTAFile = null;

const toggleConnectionBtn = document.getElementById('toggleConnectionBtn')
const chatInput = document.getElementById('chatInput')

const terminal = new BluetoothTerminal('Stair Led', '013052ff-8771-46a9-89f8-eedbedd76935')

terminal.setMtuSize(23);

function log(message, type = 'debug') {
    console.log(message)
    addToChat(message, type === 'error' ? 'red' : 'black')
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
    terminal._sendCommand(command, data, onProgress).
        catch((error) => log(error, 'error'));
}

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
                // const message = new TextDecoder().decode(data).trim();
                // try {
                // const fileInfo = JSON.parse(message);
                // console.log('fileInfo: ', fileInfo);
                // if (cachedOTAFile.name === fileInfo.name &&
                //     cachedOTAInfo.size == fileInfo.size &&
                //     cachedOTAInfo.md5 == fileInfo.md5) {

                if (cachedOTAFile) {
                    // terminal.setMtuSize(256);
                    terminal.setFastMode(true);

                    // Start send file
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        const arrayBuffer = e.target.result;
                        const uint8Array = new Uint8Array(arrayBuffer);
                        sendCommand(BLE_CMD_OTA_SEND_FILE, uint8Array, (percent) => {
                            console.log('Percent', percent);
                        });
                    };
                    reader.readAsArrayBuffer(cachedOTAFile);
                }
                //     }
                //     else {
                //         console.error("OTA file info is invalid");
                //     }
                // } catch (error) {
                //     console.error(message, ' -> ', error);
                // }
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

function updateSetting(commandName, value) {
    const message = commandName + ' ' + value
    addToChat(message, 'blue');
    sendCommand(BLE_CMD_SEND_CMD, message);
};

const idList = ['brightness', 'fadeTime', 'intervalTime', 'manualWaitTime', 'autoWaitTime', 'timerOnTime', 'timerOffTime'];
const cmdNameList = ['set-brightness-percent', 'set-fade-time', 'set-interval-time', 'set-manual-wait-time', 'set-auto-wait-time', 'set-timer-on-time', 'set-timer-off-time'];
for (let i = 0; i < idList.length; i++) {
    document.getElementById(idList[i]).addEventListener('change', function (event) {
        updateSetting(cmdNameList[i], event.target.value);
    });
}

document.getElementById('stairMode').addEventListener('change', function (event) {
    updateSetting('set-mode', event.target.value == 'auto' ? 2 : 1);
});

document.getElementById('enableTimer').addEventListener('change', function (event) {
    updateSetting('set-enable-timer', event.target.checked ? 1 : 0);
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
                mtu: 256,
            };
            const message = JSON.stringify(info);
            console.log('Prepare OTA:', message);
            sendCommand(BLE_CMD_OTA_PREPARE, message);
            cachedOTAFile = file;
        };

        reader.readAsArrayBuffer(file);
    }
});