try {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = new SpeechRecognition();
  bindSpeechRecognition()
}
catch(e) {
  console.error(e);
  $('.no-browser-support').show();
  $('.app').hide();
}

function hasUserMedia() {
   //check if the browser supports the WebRTC
   return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia);
}

console.log("hasUserMedia?" + hasUserMedia());

if (hasUserMedia()) {
  toggleStandby()
}
/*-----------------------------
      Globals
------------------------------*/
var GLOBAL_LIST = [];
var socket = new WebSocket("wss://voicenote.localtunnel.me/websocket/");
// var socket = new WebSocket("wss://tornado.localtunnel.me/websocket/");
var noteTextarea = $('#note-textarea');
var instructions = $('#recording-instructions');

var noteContent = '';

var ClientState = Object.freeze({
  "listening":1,
  "speaking":2,
  "deciding":3
})

var state = ClientState.listening;
var recogStarted = false;

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
        storedMessage = GLOBAL_LIST.shift();
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

//Want to multithread.
//Listening state seems to crash when open for too long.
//Wanting to resolve this by having a counter reset the listening state after a certain period of time.

function handleListeningState() {
    console.log("handleListeningState");
    console.log("done handleListeningState");
    //recogTimer(20);
    restartRecognition();
}
//self.onmessage = function(){
//  handleListeningState();
//}

//function recogTimer(time){
//  var countdown = setInterval(function(){
//    self.postMessage({'Timeleft': time}, '*');
//  },8000);
//}

/*-----------------------------
      Voice Recognition
------------------------------*/

// If false, the recording will stop after a few seconds of silence.
// When true, the silence period is longer (about 15 seconds),
// allowing us to keep recording even when the user pauses.
function bindSpeechRecognition() {
  recognition.continuous = false;
  recognition.interimResults = false;

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
        sendNote(transcript.toLowerCase());
      }
      noteTextarea.val(noteContent);

      setDecidingState();
    }
  };

  recognition.onaudioend = function() {
    console.log("recognition.onaudioend")
    // setDecidingState()
  }


  recognition.onerror = function(event) {
    if(event.error == 'no-speech') {
      instructions.text('No speech was detected. Try again.');
    };
  }

  recognition.onnomatch = function(e) {
    console.log("recognition.onnomatch")
  }

  recognition.onsoundend = function (e) {
    console.log("recognition.onsoundend")
    setDecidingState()
  }
}





function restartRecognition(){
  console.log("restartRecognition - off and on again.");
  recognition = new SpeechRecognition();
  bindSpeechRecognition()
  // recognition.stop();
  recognition.start();
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
  // GLOBAL_LIST.pop();
  setDecidingState();
}

function setDecidingState() {
  if (state === ClientState.deciding) {
    console.log("Already deciding")
    return
  }
  state = ClientState.deciding;
  toggleThinking();
  handleDecidingState();
}

function setListeningState() {
  if (state === ClientState.listening) {
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
  cleanHeartClasses();
  $('.heart').first().css('animation', 'rippleYellow 0.7s linear infinite');
  $("div.heart").first().addClass("heartThinking");
  //$('#heart').css('background-color', 'yellow');
}
function toggleListening(){
  cleanHeartClasses();
  $('.heart').first().css('animation', 'rippleGreen 0.7s linear infinite');
  $("div.heart").first().addClass("heartListening");
  //$('#heart').css('background-color', 'rgba(101, 255, 120, 0.8)');
}
function toggleSpeaking(){
  cleanHeartClasses();
  $('.heart').first().css('animation', 'rippleRed 0.7s linear infinite');

  $("div.heart").first().addClass("heartSpeaking");
  //$('#heart').css('background-color', 'red');
}
function toggleStandby(){
  cleanHeartClasses();
  $('.heart').first().css('animation', 'None');
  $("div.heart").first().addClass("heartStandby");
  //$('#heart').css('background-color', 'rgba(128,128,128,1)');
}
function cleanHeartClasses(){
  $("div.heart").first().removeClass("heartStandby");
  $("div.heart").first().removeClass("heartSpeaking");
  $("div.heart").first().removeClass("heartThinking");
  $("div.heart").first().removeClass("heartListening");
  $("div.heart").first().removeClass("animation");
}

//toggleSpeaking();
//$("div.heart").css(background-color, "black");

