// ----------------------------
const readingModeButtons = $$('[data-reading-mode]');
const readingLevelButtons = $$('[data-reading-level]');
const readingPrompt = $('#reading-prompt');
const wordChoices = $('#word-choices');
const readingFeedback = $('#reading-feedback');
const readingNote = $('#reading-note');
const newReadingButton = $('#new-reading');

const readingLibraries = {
  easy: [
    "The cat sat on the mat.","A red hen ran up the hill.","The dog can dig in the mud.",
    "I can see a big green frog.","The sun is hot and bright.","The fish swam in the pond.",
    "Dad had a red hat.","The fox ran into the den.","A duck sat on the wet grass.",
    "We can jump and skip.","The crab hid in the sand.","The black cat had a nap.",
    "I can clap my hands.","The frog can jump on the log.","The ship went past the rocks.",
    "The chick is in the nest.","The rain fell on the path.","The goat went up the hill.",
    "She can see the moon.","He put his coat on.","We went to the park.",
    "They can play in the sand.","You can sit with me.","The little dog is here.",
    "There is a bird in the tree.","My book is on the chair.","The girl has a blue bag.",
    "The boy went home.","I like this red kite.","We have some fresh milk.",
    "Come and look at the frog.","The train went down the track.","The sheep stood by the gate.",
    "The snail went along the path.","The queen sat on a chair.","The light was bright.",
    "The boat can float.","The cow stood in the field.","The bee buzzed by the flower.",
    "The moon shone at night.","The brown owl sat in the tree.","The horse ran past the gate."
  ],
  medium: [
    "The little rabbit hopped across the grass.","We went to the park after lunch.",
    "The bright moon shone over the houses.","My sister found a shell on the beach.",
    "The children played with a yellow ball.","A small bird landed beside the pond.",
    "The farmer shut the gate before dark.","The puppy splashed in a muddy puddle.",
    "She carried her book into the garden.","The train stopped beside the old bridge.",
    "We could hear the rain on the roof.","The squirrel climbed quickly up the tree.",
    "The kitten curled up under the chair.","Three ducks swam slowly across the lake.",
    "The boy helped his friend find her coat.","I would like to visit the farm again.",
    "There were two rabbits near the hedge.","People waited for the bus in the rain.",
    "The children made a den behind the tree.","She looked through the window at the snow.",
    "The biggest snail crawled under a leaf.","The runner was quicker than his friend.",
    "We are going to bake some cakes.","I am helping Dad wash the car.",
    "The birds are singing in the garden.","The dog jumped over the fallen branch.",
    "My friend gave me a funny little card.","The green frog disappeared into the pond.",
    "The children shouted when the race began.","A tiny spider climbed across the wall.",
    "The wind blew leaves along the road.","We packed our lunch before the long walk.",
    "The boat rocked gently beside the harbour.","The fox watched quietly from behind a bush.",
    "The girl smiled when she found her glove.","The rabbit was hiding beneath the bench.",
    "The teacher read a story about a dragon.","We watched the clouds move across the sky.",
    "The little boat sailed around the island.","The children were excited about the trip.",
    "She opened the box and found a surprise.","The fastest runner reached the line first.",
    "The ducks followed their mother to the water.","I’ll bring my boots if it starts to rain."
  ],
  hard: [
    "After breakfast, we walked through the woods and listened for birds.",
    "The enormous dragon stretched its wings before flying over the castle.",
    "When the rain stopped, the children hurried outside to find puddles.",
    "A curious squirrel watched us carefully from the highest branch.",
    "The lighthouse flashed across the dark sea while the boats sailed home.",
    "We collected smooth stones, tiny shells and feathers along the beach.",
    "The little fox disappeared quietly between the trees before we could follow.",
    "Although the path was muddy, everyone enjoyed walking through the forest.",
    "The children whispered because they did not want to wake the sleeping baby.",
    "Before bedtime, Dad read another chapter of our favourite adventure story.",
    "The bright rainbow appeared when the sunshine broke through the clouds.",
    "Our teacher showed us how caterpillars slowly change into butterflies.",
    "The excited children carried their buckets and spades towards the sea.",
    "When we reached the top of the hill, we could see the whole village.",
    "The puppy wagged its tail because somebody had opened the garden gate.",
    "My brother couldn’t find his gloves, so we looked underneath the sofa.",
    "The old wooden bridge creaked as we carefully walked across the stream.",
    "A family of ducks followed one another around the edge of the quiet pond.",
    "The astronaut looked through the window and watched Earth turning below.",
    "We planted sunflower seeds and wondered which plant would grow the tallest.",
    "The children discovered a narrow path hidden behind the thick green bushes.",
    "During the storm, flashes of lightning lit up the sky above our house.",
    "The smallest boat sailed towards the harbour while waves splashed over its side.",
    "The hungry hedgehog searched underneath the leaves for something to eat.",
    "After the race, everyone cheered for the runners and clapped their hands.",
    "The young explorer carefully drew a map so that she could find her way home.",
    "When the music started, the children danced happily around the crowded room.",
    "The enormous dinosaur left footprints across the soft ground beside the river.",
    "We watched a spider patiently build its web between two branches.",
    "The knight opened the heavy wooden door and stepped quietly into the tower.",
    "Because the night was clear, we could see hundreds of stars above the garden.",
    "The children took turns reading the funny poem aloud to the class.",
    "A sudden gust of wind lifted the kite high above the trees.",
    "The rabbit’s ears twitched when it heard a strange noise behind the fence.",
    "We followed the winding path until we reached a waterfall hidden in the woods.",
    "The magician reached into his pocket and pulled out a bright red handkerchief.",
    "Our picnic had to move indoors because dark clouds were gathering overhead.",
    "The little robot rolled across the floor and carefully picked up the blue cube.",
    "Everyone became quiet when the storyteller began the mysterious tale.",
    "The dolphin leapt out of the water before disappearing beneath the waves.",
    "She carried the basket carefully because it was filled with freshly picked apples.",
    "The children compared their drawings and explained which parts they liked best.",
    "After finishing the story, we talked about why the character had changed her mind.",
    "The owl remained completely still until a tiny mouse moved through the grass.",
    "If the weather stays sunny tomorrow, we’ll take our bikes along the canal."
  ]
};

const readingNotes = {
  easy: 'Short, familiar sentences with simple words.',
  medium: 'Longer sentences with more descriptive words.',
  hard: 'Longer sentences with richer vocabulary and more complex phrasing.'
};

const readingTests = {
  easy: [
    { sentence: 'The cat ___ on the mat.', answer: 'sat', choices: ['sat','sun','red','hop'] },
    { sentence: 'I can see a ___ duck.', answer: 'yellow', choices: ['yellow','run','milk','bed'] },
    { sentence: 'Ben can ___ the ball.', answer: 'kick', choices: ['kick','hat','rain','frog'] },
    { sentence: 'The sun is ___ today.', answer: 'warm', choices: ['warm','bus','three','pond'] },
    { sentence: 'We ___ in the park.', answer: 'play', choices: ['play','blue','toast','fish'] }
  ],
  medium: [
    { sentence: 'The rabbit hopped across the green ___.', answer: 'field', choices: ['field','shell','basket','lunch'] },
    { sentence: 'Maya found a shiny ___ beside the sea.', answer: 'shell', choices: ['shell','field','boots','moon'] },
    { sentence: 'A bright rainbow appeared after the ___.', answer: 'rain', choices: ['rain','garden','castle','book'] },
    { sentence: 'The kitten curled up inside the ___.', answer: 'basket', choices: ['basket','park','fence','seed'] },
    { sentence: 'We planted tiny seeds in the ___.', answer: 'garden', choices: ['garden','kitchen','sea','bus'] }
  ],
  hard: [
    { sentence: 'The curious squirrel hurried along the ___.', answer: 'branch', choices: ['branch','puddle','museum','bridge'] },
    { sentence: 'We waited patiently for the cake to ___.', answer: 'bake', choices: ['bake','whisper','count','twist'] },
    { sentence: 'A narrow path twisted through the ___.', answer: 'woods', choices: ['woods','sofa','shelf','island'] },
    { sentence: 'Frost covered the grass that ___.', answer: 'morning', choices: ['morning','journey','pirate','skeleton'] },
    { sentence: 'The pirate searched for the hidden ___.', answer: 'island', choices: ['island','leaves','coat','flour'] }
  ]
};

let readingMode = localStorage.getItem('readingMode') || 'read';
let readingLevel = localStorage.getItem('readingLevel') || 'easy';
let lastReadingIndex = -1;
let activeReadingTest = null;

function setReadingMode(mode) {
  readingMode = mode;
  localStorage.setItem('readingMode', mode);
  readingModeButtons.forEach(button => button.classList.toggle('active', button.dataset.readingMode === mode));
  generateReading();
}

function setReadingLevel(level) {
  readingLevel = level;
  localStorage.setItem('readingLevel', level);
  readingLevelButtons.forEach(button => button.classList.toggle('active', button.dataset.readingLevel === level));
  readingNote.textContent = readingNotes[level];
  lastReadingIndex = -1;
  generateReading();
}

function generateReading() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  readingFeedback.classList.remove('good','bad');
  wordChoices.innerHTML = '';

  if (readingMode === 'read') {
    const library = readingLibraries[readingLevel];
    let index = randomInt(0, library.length - 1);
    if (library.length > 1 && index === lastReadingIndex) index = (index + 1) % library.length;
    lastReadingIndex = index;
    readingPrompt.textContent = library[index];
    wordChoices.classList.add('hidden');
    readingFeedback.textContent = '';
    newReadingButton.textContent = 'New Sentence';
    return;
  }

  const items = readingTests[readingLevel];
  activeReadingTest = items[randomInt(0, items.length - 1)];
  const parts = activeReadingTest.sentence.split('___');
  readingPrompt.innerHTML = `${parts[0]}<span class="blank">?</span>${parts[1] || ''}`;
  readingFeedback.textContent = '';
  wordChoices.classList.remove('hidden');
  newReadingButton.textContent = 'New Question';

  const shuffled = [...activeReadingTest.choices].sort(() => Math.random() - 0.5);
  shuffled.forEach(word => {
    const button = document.createElement('button');
    button.className = 'word-choice';
    button.textContent = word;
    button.addEventListener('click', () => checkReadingChoice(button, word));
    wordChoices.appendChild(button);
  });
}

function checkReadingChoice(button, word) {
  if (!activeReadingTest) return;
  const buttons = wordChoices.querySelectorAll('.word-choice');
  buttons.forEach(b => b.disabled = true);
  if (word === activeReadingTest.answer) {
    button.classList.add('correct');
    readingFeedback.classList.add('good');
    readingFeedback.textContent = 'Yes — that fits! ★';
  } else {
    button.classList.add('wrong');
    readingFeedback.classList.add('bad');
    readingFeedback.textContent = `Good try — the word is “${activeReadingTest.answer}”.`;
    buttons.forEach(b => {
      if (b.textContent === activeReadingTest.answer) b.classList.add('correct');
    });
  }
}

readingModeButtons.forEach(button => button.addEventListener('click', () => setReadingMode(button.dataset.readingMode)));
readingLevelButtons.forEach(button => button.addEventListener('click', () => setReadingLevel(button.dataset.readingLevel)));
newReadingButton.addEventListener('click', generateReading);
setReadingLevel(readingLevel);
setReadingMode(readingMode);



// Reading aloud using the device/browser speech synthesiser.
const readingSpeakButton = $("#reading-speak");
const readingSpeakLabel = $("#reading-speak-label");
const readingVoiceSelect = $("#reading-voice-select");
let readingVoiceKey = localStorage.getItem("readingVoiceKey") || "";
const readingSpeechRate = 0.95;

function stopReadingSpeech() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  readingSpeakButton.classList.remove("speaking");
  readingSpeakLabel.textContent = "Read aloud";
}

function readingTextForSpeech() {
  if (readingMode === "read") return readingPrompt.textContent.trim();
  if (!activeReadingTest) return "";
  return activeReadingTest.sentence.replace("___", " ... ");
}

function readingVoiceId(v){return `${v.name}||${v.lang}`;}
function populateReadingVoices(){
  if(!("speechSynthesis" in window))return;
  const voices=window.speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang)).sort((a,b)=>(/^en-GB$/i.test(a.lang)?0:1)-(/^en-GB$/i.test(b.lang)?0:1)||a.name.localeCompare(b.name));
  readingVoiceSelect.innerHTML='<option value="">Default English voice</option>';
  voices.forEach(v=>{const o=document.createElement("option");o.value=readingVoiceId(v);o.textContent=`${v.name} (${v.lang})`;readingVoiceSelect.appendChild(o);});
  if([...readingVoiceSelect.options].some(o=>o.value===readingVoiceKey))readingVoiceSelect.value=readingVoiceKey;
}
function chooseReadingVoice(){
  if(!("speechSynthesis" in window))return null;
  const voices=window.speechSynthesis.getVoices();
  return (readingVoiceKey&&voices.find(v=>readingVoiceId(v)===readingVoiceKey))||voices.find(v=>/^en-GB$/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang))||voices[0]||null;
}

function speakReadingText() {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    readingFeedback.classList.remove("good");
    readingFeedback.classList.add("bad");
    readingFeedback.textContent = "Read aloud is not available on this device.";
    return;
  }

  if (window.speechSynthesis.speaking) {
    stopReadingSpeech();
    return;
  }

  const text = readingTextForSpeech();
  if (!text) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = readingSpeechRate;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voice = chooseReadingVoice();
  if (voice) utterance.voice = voice;

  utterance.onstart = () => {
    readingSpeakButton.classList.add("speaking");
    readingSpeakLabel.textContent = "Stop";
  };
  utterance.onend = stopReadingSpeech;
  utterance.onerror = stopReadingSpeech;

  window.speechSynthesis.cancel();
  // iOS Safari can ignore a speak() issued in the same tick as cancel().
  setTimeout(() => window.speechSynthesis.speak(utterance), 0);
}

readingSpeakButton.addEventListener("click", speakReadingText);
readingVoiceSelect.addEventListener("change",()=>{stopReadingSpeech();readingVoiceKey=readingVoiceSelect.value;localStorage.setItem("readingVoiceKey",readingVoiceKey);});
populateReadingVoices();
if("speechSynthesis" in window)window.speechSynthesis.addEventListener?.("voiceschanged",populateReadingVoices);

