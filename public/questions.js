// Everything Sydney reads lives in this file, so the words are easy to change.
// `label` is what's printed on the wheel. `nudge` shows up a few seconds into a recording.

export const JACKPOT_AT = 7; // answers needed to hit 777
export const TIMEOUTS = 2; // re-spins she can call without answering

export const QUESTIONS = [
  {
    id: 'tuesday',
    label: 'Tuesday',
    q: 'Walk me through a regular Tuesday, from when your eyes open to when you fall asleep.',
    nudge: 'Which part of that day is yours and nobody else’s?',
  },
  {
    id: 'three-words',
    label: 'Three Words',
    q: 'What three words would the people closest to you use to describe you?',
    nudge: 'Which one would you argue with?',
  },
  {
    id: 'the-swap',
    label: 'The Swap',
    q: 'T wakes up as you. What does he get wrong before lunch?',
    nudge: 'What part of being you would he never figure out?',
  },
  {
    id: 'the-coat',
    label: 'The Coat',
    q: 'You put on a coat you haven’t worn since last winter and there’s $777 in the pocket. Nobody knows about it. Where is every dollar by Friday?',
    nudge: 'Who gets some of it without having to ask?',
  },
  {
    id: 'the-sub',
    label: 'The Sub',
    q: 'You get a week off from being you. Somebody you actually know has to cover the whole thing: your job, your people, your week. Who do you hand it to, and which day breaks them?',
    nudge: 'What would hit them that they’d never see coming?',
  },
  {
    id: 'im-fine',
    label: 'I’m Fine',
    q: 'You just said “I’m fine.” You are not fine. Call the next ten minutes like a game announcer.',
    nudge: 'What in the house gets handled a little too hard?',
  },
  {
    id: 'camera-roll',
    label: 'Camera Roll',
    q: 'Before you open your camera roll, guess what your last ten photos are. Then open it and tell me what’s really there. Skip any you want.',
    nudge: 'What’s in there that you didn’t guess?',
  },
  {
    id: 'drive-thru',
    label: 'Drive-Thru',
    q: 'You’re running a drive-thru for one shift, and you get to make one new rule. What’s the rule, and who gets banned first?',
    nudge: 'Who do you let slide even though they broke it?',
  },
  {
    id: 'fridge-note',
    label: 'Fridge Note',
    q: 'Somebody’s staying at your place for a long weekend while you’re gone. Read me the note you leave on the fridge. The real one, not the polite one.',
    nudge: 'Which line did you almost leave off?',
  },
  {
    id: 'ts-phone',
    label: 'T’s Phone',
    q: 'You wake up as T. His phone’s unlocked, his voice works, and you’ve got until noon before anybody catches on. You get three calls or texts. Who gets them, and what do you say?',
    nudge: 'Which one should T have sent already?',
  },
];

export const GPT_PROMPT = `I'm helping a friend with a comedy video where he and I swap bodies, Freaky Friday style. He wants the version of me in it to be accurate, so I'm asking you, because you've seen how I actually talk and what I actually ask about.

Use everything you remember about me from our chats and your saved memories. Be specific and honest. I'd rather be recognizable than flattered. Quote me where you can. If you don't know something, say "don't know" instead of guessing. Leave out anything about my health, my money, legal matters, and other people's private business.

Answer these seven, numbered:

1. How I talk. Ten words or phrases I use a lot. How I open a message when I want something. How my writing changes when I'm annoyed, when I'm excited, and when I'm worn out.
2. What I come to you for. The top five kinds of things, most common first, with a rough share for each.
3. What I ask you to rewrite or soften before I send it, and what kind of person it's usually going to. No names.
4. What I keep circling back to in slightly different words, and what I keep saying I'm going to do.
5. Where what I say about myself doesn't match what you've seen me do.
6. If an actor had to play me in an everyday scene (ordering food, arguing, giving directions): three habits that would sell it, and the one mistake that would give them away.
7. Write as me. A short text exchange where I turn down plans with a friend. Then one line I'd say, and one line I'd never say.

Keep the whole thing under 600 words.`;

// The Neil deGrasse Tyson time-out: true numbers, worked out from how long she talked.
const n = (x) => Math.round(x).toLocaleString('en-US');
export const FACTS = [
  (s) => `While you talked, the Earth carried you about ${n(s * 18.5)} miles around the Sun.`,
  (s) =>
    s < 499
      ? `Sunlight that left the Sun when you hit record is ${Math.round((s / 499) * 100)}% of the way here. The full trip takes 8 minutes 19 seconds.`
      : `Sunlight that left the Sun when you hit record has already landed. The trip takes 8 minutes 19 seconds, and you outlasted it.`,
  (s) => `While you talked, the Sun turned about ${n(s * 4)} million tons of itself into light.`,
  (s) => `While you talked, the space station covered about ${n(s * 4.76)} miles. It laps the planet every 92 minutes.`,
  (s) => `While you talked, the whole solar system moved about ${n(s * 143)} miles around the middle of the galaxy. One lap takes 230 million years.`,
  (s) => `While you talked, lightning hit the Earth about ${n(s * 44)} times.`,
  (s) => `While you talked, Voyager 1 got about ${n(s * 10.5)} miles farther from home. It left in 1977.`,
];
export const FACT_TYPED = 'You typed that one, so the universe couldn’t time you. It kept moving anyway.';
