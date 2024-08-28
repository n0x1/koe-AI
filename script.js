const apiKey = import.meta.env.VITE_HC_API_KEY;
let userMessage;
let messageViaText = false;

async function hear() {
  return new Promise((resolve, reject) => {
    let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = new SpeechRecognition();

    recognition.start();

    recognition.addEventListener('result', function (event) {
      let current = event.resultIndex;
      let transcript = event.results[current][0].transcript;
      resolve(transcript);
    });

    recognition.addEventListener('error', function (event) {
      reject(event.error);
    });

    recognition.addEventListener('end', function () {
      recognition.stop();
    });
  });
}

let messages = []; // these are from koe
let userPrompts = []

function saveMessages() { // save to Local Storage
  localStorage.setItem('messages', JSON.stringify(messages));
}



function loadMessages() { // load from lcoalstorage
  const savedMessages = localStorage.getItem('messages');
  if (savedMessages) {
    messages = JSON.parse(savedMessages);
    messages.forEach(message => {
      addMessage(message);
    });
  }
}
document.addEventListener('DOMContentLoaded', loadMessages);



function clearMessages() {
  localStorage.removeItem('messages');
  document.getElementById('messages').innerHTML = '';
  messages = [];
}
document.getElementById('clearmessagesbutton').addEventListener('click', function() {
  clearMessages();

});




function addMessage({ role, content }) {
  let message = document.createElement('div');
  message.innerText = content;
  userMessage = content;
  document.getElementById("messages").appendChild(message);

  if (role === 'user') message.classList.add('user');
  else message.classList.add('system');
  document.getElementById('messages').appendChild(message);
  message.scrollIntoView(true); // Scroll to the message

  saveMessages() // save to localstorage
}



function saveVoice(selection) {
  localStorage.setItem('selectedVoice', selection);
}

function loadVoice() {
  const savedVoice = localStorage.getItem('selectedVoice');
  if (savedVoice) {
    voiceSelection.value = savedVoice;
    changePitchAndVoiceIndex(savedVoice)
  }
}
document.addEventListener('DOMContentLoaded', loadVoice)


let voiceIndex = 2 // defaults for ちゃん
let pitch = 1.2;

const voiceSelection = document.getElementById('voiceChoice');
voiceSelection.addEventListener('change', function() {
  let selectedVoice = voiceSelection.value;
  saveVoice(selectedVoice)
  changePitchAndVoiceIndex(selectedVoice)

});

function changePitchAndVoiceIndex(selectedVoice) {
  if (selectedVoice === 'コエちゃん') {
    voiceIndex = 2;
    pitch = 1.2;
  } else if (selectedVoice === 'コエくん') {
    voiceIndex = 0;
    pitch = 1;
  } else if (selectedVoice === 'コエさん') {
    voiceIndex = 1;
    pitch = 0.85;
  }
}


async function speak(message) {
  return new Promise((resolve, reject) => {
    let synth = window.speechSynthesis;

    if (synth) {
      let utterance = new SpeechSynthesisUtterance(message);

      const loadVoices = () => {
        const voices = synth.getVoices();
        const japaneseVoices = voices.filter(voice => voice.lang === "ja-JP");

        if (japaneseVoices.length === 0) {
          console.error('Your browser does not support Japanese speech synthesis.');
          reject('Your browser does not support Japanese speech synthesis.');
        }

        utterance.voice = japaneseVoices[voiceIndex];
        utterance.lang = "ja-JP";
        utterance.pitch = pitch; 
        synth.speak(utterance);
        utterance.onend = () => resolve();
      };

      if (synth.getVoices().length > 0) {
        loadVoices();
      } else {
        synth.onvoiceschanged = loadVoices;
      }
    } else {　
      reject('speechSynthesis not compatible with your browser');
    }
  });
}

async function answer(message) {
  async function fetchData() {
    const response = await fetch("https://jamsapi.hackclub.dev/openai/chat/completions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        'model': 'gpt-3.5-turbo',
        'messages': [
          {
            'role': 'user',
            'content': `You are a native speaker, highly knowledgable Japanese teacher, named Koe, who is teaching students contextual vocabulary words and phrases. A student will describe a scenario in English, then you must use all the details of the description to produce one or several words or phrases that are the most fitting and specific for only the key vocabulary in that scenario. Your responses should contain only an unnumbered list of the word or phrase generated, with no preamble or other text that is not the vocabulary. Focus on the intent of the description to provide the best word or phrase. The list should be formatted with the word/phrase, then English definition; with a new line for each new vocabulary. Do not use English outside of defining the Japanese vocabulary. Directly after Kanji words, provide the kanji's furigana enclosed in parentheses. Additionally, after any words which may be な adjectives, place a ~な directly after. An example of your typical response, formatted correctly: 'I slipped on a banana peel in the supermarket
            げんき~な (げんき) : energetic, lively
            転ぶ (ころぶ) : to slip/fall
            スーパー : supermarket'
            Here is the student's scenario: ${message}`
          }
        ],
        'max_tokens': 50,
        'temperature': 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return response.json();
  }

  try {
    const data = await fetchData();
    return {
      role: 'system',
      content: data.choices[0]?.message?.content || 'No content returned'
    };
  } catch (error) {
    console.error('Error fetching data:', error);
    return {
      role: 'system',
      content: 'An error occurred'
    };
  }
}

let result;
async function process() {
  document.getElementById('result').style.display = 'block';

  document.getElementById('chatinput').style.display = 'none';

  try {
    if (messageViaText != true) {
      result = await hear();
    } else {
      result = getMessageContent()
    }

    document.getElementById('chatinput').value = '' // clear chat input
    document.getElementById('result').style.display = 'none';


    let message = { role: 'user', content: result };
    addMessage(message);
    messages.push(message); // push the USER's message.

    document.getElementById('loading').style.display = 'block'; // await GPT response
    const response = await answer(result);
    response.role = 'system';

    messages.push(response);
    addMessage(response);

   
    document.getElementById('loading').style.display = 'none'
    await speak(response.content);
    document.getElementById('loading').style.display = 'none';

    document.getElementById('chatinput').style.display = 'block'; // displays change; loading and result are the 聞いているand考えている
    messageViaText = false
  } catch (error) {
    console.error('Error processing:', error); 
    document.getElementById('loading').style.display = 'none'; 
    document.getElementById('chatinput').style.display = 'block';
    document.getElementById('chatinput').value = ''
    messageViaText = false
  
  }
}


// settings
let settingsIcon = document.getElementById('settings')
let settingsContainer = document.getElementById('settingsContainer')
let settingsVisible = false
settingsContainer.style.display = 'none'

settingsIcon.addEventListener('click', function() {
  settingsVisible = !settingsVisible
  settingsVisible ? settingsContainer.style.display = 'block' : settingsContainer.style.display = 'none'
})


// sending messages
function getMessageContent() {
  let content = document.getElementById('chatinput').value
  return content
}


document.getElementById('chatinput').addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    listening = true // well typing but this is global
    event.preventDefault();
    if (document.getElementById('chatinput').value === '') {
      return 1
    } else {
     
      messagingViaTextFunction()
    }

   
  }
});


function messagingViaTextFunction() {
  messageViaText = true
  process()
}