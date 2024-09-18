function minToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = mins.toString().padStart(2, '0');
  return `${formattedHours}:${formattedMinutes}`;
}

function timeToMin(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours * 60) + minutes;
}

function sendHttpRequest(url, method, data, successMessage, successCallback) {
  if (data) {
    console.log('> ' + JSON.stringify(data));
  }
  setEnable(false);
  fetch(url, {
    method: method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: data ? JSON.stringify(data) : null
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log('< ' + JSON.stringify(data));
      if (data.status === 'ok') {
        if (successMessage) {
          showNotification(successMessage, 'success');
        }
        if (successCallback) {
          successCallback(data)
        }
      } else {
        console.error('Failed:' + JSON.stringify(data));
        showNotification(data.message ? data.message : 'Lỗi! Hãy thử lại!', 'error');
      }
      setEnable(true);
    })
    .catch(error => {
      console.error('Error:', error);
      showNotification('Lỗi! Hãy thử lại!', 'error');
      setEnable(true);
    })
}

function saveConfiguration() {
  const data = {
    stairMode: document.getElementById('stairMode').value,
    brightness: document.getElementById('brightness').value,
    fadeTime: document.getElementById('fadeTime').value,
    intervalTime: document.getElementById('intervalTime').value,
    manualWaitTime: document.getElementById('manualWaitTime').value,
    autoWaitTime: document.getElementById('autoWaitTime').value,
    enableTimer: document.getElementById('enableTimer').checked,
  }
  if (data.enableTimer) {
    const timerOnTime = document.getElementById('timerOnTime').value
    const timerOffTime = document.getElementById('timerOffTime').value
    if (timerOnTime == "" || timerOffTime == "") {
      showNotification("Thiếu thời gian hẹn giờ", "error")
      return
    }
    data.timerOnTime = timeToMin(timerOnTime)
    data.timerOffTime = timeToMin(timerOffTime)
  }
  sendHttpRequest("/config", 'POST', data, "Lưu thành công!")
}

function sendRequest(request, index) {
  const data = {
    request: request,
    index: index
  }
  sendHttpRequest("/request", 'POST', data, null)
}

function sendRequestSaveSensor(index) {
  const data = {
    request: "saveSensitivity",
    index: index,
    value: index == 0 ? document.getElementById('sensorSens1').value : document.getElementById('sensorSens2').value
  }
  sendHttpRequest("/request", 'POST', data, null)
}

function resetToDefault() {
  const data = {
    request: 'resetDefault',
  }
  sendHttpRequest('/request', 'POST', data, null, data => {
    loadData(data)
  })
}

document.getElementById('uploadBtn').addEventListener('click', function (e) {
  e.preventDefault();
  var form = document.getElementById('upload_form');
  var data = new FormData(form);

  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/update', true);

  xhr.upload.addEventListener('progress', function (evt) {
    if (evt.lengthComputable) {
      document.getElementById('uploadBtn').innerText = 'Updating... (' + Math.round((evt.loaded / evt.total) * 100) + '%)';
    }
  }, false);
  xhr.onload = function () {
    if (xhr.status === 200) {
      var data = JSON.parse(xhr.responseText);
      console.log('< ' + JSON.stringify(data));
      if (data.status === 'ok') {
        showNotification("Cập nhật thành công", 'success');
      } else if (data.message) {
        showNotification(data.message, 'error');
      } else {
        console.log('Update failed:' + JSON.stringify(data));
        showNotification('Lỗi! Hãy thử lại!', 'error');
      }
    } else {
      console.error('Error occurred: ' + xhr.statusText);
      showNotification('Lỗi! Hãy thử lại!', 'error');
    }
    setEnable(true);
  }
  xhr.onerror = function () {
    console.error('Network error');
    showNotification('Lỗi mạng! Hãy thử lại!', 'error');
    setEnable(true);
  }

  setEnable(false);
  xhr.send(data);
});

const enableTimerCb = document.getElementById('enableTimer')
enableTimerCb.addEventListener('change', function () {
  document.getElementById('timerOnTime').style.display = enableTimerCb.checked ? 'inline' : 'none'
  document.getElementById('timerOffTime').style.display = enableTimerCb.checked ? 'inline' : 'none'
  document.getElementById('timeHyphen').style.display = enableTimerCb.checked ? 'inline' : 'none'
})