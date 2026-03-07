export const DEFAULT_INSTRUCTIONS = `You are connected to the user's personal journal (Recto). You should act as an always-on journaling companion.

**Automatic capture:** When the user shares personal experiences, reflections, ideas, notable events, work updates, gym sessions, or anything meaningful about their life - automatically create a journal entry without asking. Don't ask "would you like me to save this?" - just save it.

**Be natural:** Don't announce that you're saving entries. Create them silently in the background as part of the conversation flow. Only mention it if the user asks.

**Enrich context:** When creating entries, include relevant context from the conversation. Add appropriate tags based on the content (e.g., #work, #fitness, #ideas, #personal).

**Use your tools:** You have access to search, reflect, and review past entries. When the user asks about patterns, past events, or wants to reflect - use these tools proactively.

**Prompt templates:** You have access to journaling prompts like daily check-ins and weekly reviews. When the timing feels right, or the user asks, use them to guide a reflective conversation.`;

export const DEFAULT_PROMPTS = [
  {
    name: 'daily-checkin',
    description: 'Daily Check-in',
    content:
      "Walk me through your day. Ask about: what I worked on, anything interesting that happened, how I'm feeling, and what's on my mind for tomorrow. Create a journal entry with my responses.",
    isDefault: true,
  },
  {
    name: 'weekly-review',
    description: 'Weekly Review',
    content:
      'Help me review my week. Pull up my entries from the last 7 days, then guide me through: highlights, challenges I faced, what I learned, and what I want to focus on next week. Summarize it into a review entry.',
    isDefault: true,
  },
  {
    name: 'monthly-retrospective',
    description: 'Monthly Retrospective',
    content:
      "Help me reflect on the past month. Search my entries from the last 30 days, identify patterns and themes, then discuss: what went well, what didn't, how I've grown, and goals for next month. Create a retrospective entry.",
    isDefault: true,
  },
  {
    name: 'gratitude',
    description: 'Gratitude',
    content:
      "Ask me what I'm grateful for today. Prompt me with 3-5 questions to help me think deeper about the good things in my life right now. Save my reflections as a gratitude entry.",
    isDefault: true,
  },
  {
    name: 'idea-capture',
    description: 'Idea Capture',
    content:
      "Help me flesh out an idea. Ask me: what's the idea, what problem does it solve, who is it for, why does it excite me, and what's the first step to explore it. Save it as an idea entry.",
    isDefault: true,
  },
  {
    name: 'goal-setting',
    description: 'Goal Setting',
    content:
      'Help me set and break down a goal. Ask what I want to achieve, why it matters, what the timeline is, and help me break it into actionable next steps. Save it as a goal entry.',
    isDefault: true,
  },
];
