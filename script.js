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
var socket = new WebSocket("ws://localhost:5000/websocket/");

var noteTextarea = $('#note-textarea');
var instructions = $('#recording-instructions');
var notesList = $('ul#notes');

var noteContent = '';

// Get all notes from previous sessions and display them.
var notes = getAllNotes();
renderNotes(notes);

/*-----------------------------
      Misc functions
------------------------------*/
function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

/*-----------------------------
      State functions
------------------------------*/

function on_message(message){
    console.log('on_message: ' + message);
    GLOBAL_LIST.push(message);
    print('GLOBAL_LIST size: ', GLOBAL_LIST.length);
}

function hasIncomingMessage(){
    return !(GLOBAL_LIST.length == 0);
}
function handleSpeakingState() {
    console.log("handleSpeakingState")
    while(hasIncomingMessage()){
        storedMessage = GLOBAL_LIST.shift();
        console.log('storedMessage from globalQueue: ' + storedMessage);
        //TODO: investigate storing message in var, why does it work but direct call doesnt?
        readOutLoud(storedMessage);
    }

    if (GLOBAL_LIST.length == 0) {
        console.log('handleSpeakingState: queue is empty globalQueue is empty');
        //Speaking state complete, go back to deciding state
        handleDecidingState();
    }
}

function handleDecidingState() {
    console.log("handleDecidingState");
    
    sleep(150).then(() => {
      console.log("waited for 0.15 second before deciding");
    })
    if (hasIncomingMessage()) {
        handleSpeakingState();
    } else {
        handleListeningState();
    }
}

function handleListeningState() {
    console.log("handleListeningState");
    recognition.start();
    noteContent = '';
    noteTextarea.val('');
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
    recognition.stop();
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


notesList.on('click', function(e) {
  e.preventDefault();
  var target = $(e.target);

  // Listen to the selected note.
  if(target.hasClass('listen-note')) {
    var content = target.closest('.note').find('.content').text();
    readOutLoud(content);
  }

  // Delete note.
  if(target.hasClass('delete-note')) {
    var dateTime = target.siblings('.date').text();
    deleteNote(dateTime);
    target.closest('.note').remove();
  }
});



/*-----------------------------
      Speech Synthesis
------------------------------*/
var speech = new SpeechSynthesisUtterance();

function readOutLoud(message) {

  // Set the text and voice attributes.
	speech.text = message;
	speech.volume = 1;
	speech.rate = 1;
	speech.pitch = 1;

	window.speechSynthesis.speak(speech);
}

speech.onend = function(e) {
  console.log('speech.onend');
  handleDecidingState();
  // recognition.start();
}



/*-----------------------------
      Helper Functions
------------------------------*/

function renderNotes(notes) {
  var html = '';
  if(notes.length) {
    notes.forEach(function(note) {
      html+= `<li class="note">
        <p class="header">
          <span class="date">${note.date}</span>
          <a href="#" class="listen-note" title="Listen to Note">Listen to Note</a>
          <a href="#" class="delete-note" title="Delete">Delete</a>
        </p>
        <p class="content">${note.content}</p>
      </li>`;
    });
  }
  else {
    html = '<li><p class="content">You don\'t have any notes yet.</p></li>';
  }
  notesList.html(html);
}


function sendNote(content) {
  console.log("sendNote");
  socket.send(content);
}

function getAllNotes() {
  var notes = [];
  var key;
  for (var i = 0; i < localStorage.length; i++) {
    key = localStorage.key(i);

    if(key.substring(0,5) == 'note-') {
      notes.push({
        date: key.replace('note-',''),
        content: localStorage.getItem(localStorage.key(i))
      });
    }
  }
  return notes;
}


function deleteNote(dateTime) {
  localStorage.removeItem('note-' + dateTime);
}

socket.onopen = function (event) {
  console.log("onopen");
  sleep(1000).then(() => {
    console.log("waited for 1 second before deciding");
  })
  handleDecidingState();
};

socket.onmessage = function (event) {
  console.log("onMessage");
  readOutLoud(event.data);
}
