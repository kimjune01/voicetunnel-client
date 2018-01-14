try {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = new SpeechRecognition();
}
catch(e) {
  console.error(e);
  $('.no-browser-support').show();
  $('.app').hide();
}

/*-----------------------------
      Globals
------------------------------*/
var GLOBAL_LIST = [];
// var socket = new WebSocket("ws://voiceminder.localtunnel.me/websocket/");
var socket = new WebSocket("ws://voiceminder.localtunnel.me/websocket/");

var noteTextarea = $('#note-textarea');
var instructions = $('#recording-instructions');

var noteContent = '';

var ClientState = Object.freeze({
  "listening":1,
  "speaking":2,
  "deciding":3
})

var state = ClientState.deciding;


/*-----------------------------
      Misc functions
------------------------------*/
function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

/*-----------------------------
      State functions
------------------------------*/

function hasIncomingMessage(){
  return GLOBAL_LIST.length > 0;
}

function handleSpeakingState() {
    console.log("handleSpeakingState")
    if (hasIncomingMessage()) {
        storedMessage = GLOBAL_LIST[0];
        readOutLoud(storedMessage);
        return;
    }

    if (GLOBAL_LIST.length == 0) {
      setDecidingState();
    }
}

function handleDecidingState() {
  console.log("handleDecidingState");
  recognition.stop();
  sleep(150).then(() => {
  });
  if (hasIncomingMessage()) {
    setSpeakingState();
  } else {
    setListeningState();
  }
}

function handleListeningState() {
    console.log("handleListeningState");
    recognition.stop();
    recognition.start();
}



/*-----------------------------
      Voice Recognition
------------------------------*/

// If false, the recording will stop after a few seconds of silence.
// When true, the silence period is longer (about 15 seconds),
// allowing us to keep recording even when the user pauses.
recognition.continuous = true;

// This block is called every time the Speech APi captures a line.
recognition.onresult = function(event) {
  console.log("recognition.onresult");

  // event is a SpeechRecognitionEvent object.
  // It holds all the lines we have captured so far.
  // We only need the current one.
  var current = event.resultIndex;

  // Get a transcript of what was said.
  var transcript = event.results[current][0].transcript;

  // Add the current transcript to the contents of our Note.
  // There is a weird bug on mobile, where everything is repeated twice.
  // There is no official solution so far so we have to handle an edge case.
  var mobileRepeatBug = (current == 1 && transcript == event.results[0][0].transcript);

  if(!mobileRepeatBug) {
    noteContent += transcript;
    if (transcript != "") {
      sendNote(transcript);
    }
    noteTextarea.val(noteContent);

    setDecidingState();
  }
};

recognition.onstart = function() {
  instructions.text('Voice recognition activated. Try speaking into the microphone.');
}

recognition.onspeechend = function() {
  instructions.text('You were quiet for a while so voice recognition turned itself off.');
}

recognition.onerror = function(event) {
  if(event.error == 'no-speech') {
    instructions.text('No speech was detected. Try again.');
  };
}


/*-----------------------------
      App buttons and input
------------------------------*/

$('#start-record-btn').on('click', function(e) {
  if (noteContent.length) {
    noteContent += ' ';
  }
  recognition.start();
});


$('#pause-record-btn').on('click', function(e) {
  recognition.stop();
  instructions.text('Voice recognition paused.');
});

// Sync the text inside the text area with the noteContent variable.
noteTextarea.on('input', function() {
  noteContent = $(this).val();
})

$('#save-note-btn').on('click', function(e) {
  recognition.stop();

  if(!noteContent.length) {
    instructions.text('Could not save empty note. Please add a message to your note.');
  }
  else {
    // Save note to localStorage.
    // The key is the dateTime with seconds, the value is the content of the note.
    sendNote(noteContent);
    // saveNote(new Date().toLocaleString(), noteContent);

    // Reset variables and update UI.
    noteContent = '';
    noteTextarea.val('');
  }

})



/*-----------------------------
      Speech Synthesis
------------------------------*/
var speech = new SpeechSynthesisUtterance();

function readOutLoud(message) {
  // Set the text and voice attributes.
  state = ClientState.speaking
	speech.text = message;
	speech.volume = 1;
	speech.rate = 1;
	speech.pitch = 1;
	window.speechSynthesis.speak(speech);

}

speech.onend = function(e) {
  console.log('speech.onend');
  GLOBAL_LIST.pop();
  setDecidingState();
}

function setDecidingState() {
  state = ClientState.deciding;
  toggleThinking();
  handleDecidingState();
}

function setListeningState() {
  if (state == ClientState.listening) {
    console.log("Already listening");
    return;
  }
  state = ClientState.listening;
  toggleListening();
  handleListeningState();
}

function setSpeakingState() {
  state = ClientState.speaking;
  toggleSpeaking();
  handleSpeakingState();
}

/*-----------------------------
      Helper Functions
------------------------------*/


function sendNote(content) {
  console.log("sendNote: ", content);
  socket.send(content);
}



function deleteNote(dateTime) {
  localStorage.removeItem('note-' + dateTime);
}

socket.onopen = function (event) {
  console.log("onopen");
  sleep(1000).then(() => {
    console.log("waited for 1 second before deciding");
  })
  setDecidingState();
};

socket.onmessage = function (event) {
  console.log('onmessage: ' + event.data);
  GLOBAL_LIST.push(event.data);
  setDecidingState();
}

/*-----------------------------
      Circle Functions
------------------------------*/

/*
Thinking - yellow
speaking - red
Listening - green
Standby - no animation, grey.
*/

function toggleThinking(){
  $('#trafficlight').css('animation', 'rippleYellow 0.7s linear infinite');
  $('#trafficlight').css('background-color', 'yellow');
}
function toggleListening(){
  $('#trafficlight').css('animation', 'rippleGreen 0.7s linear infinite');
  $('#trafficlight').css('background-color', 'rgba(101, 255, 120, 0.8)');
}
function toggleSpeaking(){
  $('#trafficlight').css('animation', 'rippleRed 0.7s linear infinite');
  $('#trafficlight').css('background-color', 'red');
}
function toggleStandby(){
  $('#trafficlight').css('animation', 'None');
  $('#trafficlight').css('background-color', 'rgba(128,128,128,1)');
}
