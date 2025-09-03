import { CloudflareLLM } from "../llms/CloudflareLLM";
import { entityExtractionPrompt } from "../prompts/entityExtraction";

interface ExtractedEntities {
  medications: Array<{ name: string; dosage: string; frequency: string }>;
  medical_professionals: Array<{
    name: string;
    specialty: string;
    relationship: string;
  }>;
  appointments: Array<{
    type: string;
    datetime: string;
    location: string;
    provider: string;
  }>;
  health_conditions: Array<{
    condition: string;
    severity: string;
    status: string;
  }>;
  symptoms: Array<{ description: string; frequency: string; severity: string }>;
  family_members: Array<{ name: string; relationship: string }>;
  activities: Array<{ type: string; frequency: string; concerns: string }>;
  locations: Array<{ address: string; facility: string; importance: string }>;
  emotional_states: Array<{
    mood: string;
    intensity: string;
    triggers: string;
    duration: string;
  }>;
  concerns_worries: Array<{
    topic: string;
    severity: string;
    frequency: string;
  }>;
  positive_moments: Array<{
    achievement: string;
    joy: string;
    satisfaction: string;
    social_connection: string;
  }>;
  social_interactions: Array<{
    who: string;
    relationship: string;
    frequency: string;
    quality: string;
  }>;
  daily_routine_changes: Array<{
    what_changed: string;
    impact_on_mood: string;
    adaptation: string;
  }>;
  future_tasks: Array<{
    task: string;
    priority: string;
    help_needed: boolean;
    deadline: string;
  }>;
  reminders: Array<{
    reminder: string;
    frequency: string;
    importance: string;
  }>;
  goals: Array<{
    goal: string;
    timeline: string;
    progress: string;
  }>;
  trivia_interests: Array<{
    topic: string;
    difficulty: string;
    enjoyment_level: string;
  }>;
  game_preferences: Array<{
    game_type: string;
    skill_level: string;
    frequency: string;
  }>;
  entertainment_requests: Array<{
    type: string;
    mood: string;
    time_of_day: string;
  }>;
  cognitive_activities: Array<{
    activity: string;
    interest_level: string;
    challenge_preference: string;
  }>;
}

export async function extractEntities(
  conversationText: string,
  llm: CloudflareLLM
): Promise<ExtractedEntities | null> {
  try {
    console.log("🔍 Extracting entities from conversation...");

    // Format the prompt with the conversation text
    const prompt = await entityExtractionPrompt.format({
      conversation_text: conversationText,
    });

    // Call the LLM for JSON response
    const response = await llm._call(prompt);

    // Parse the JSON response
    const cleanedResponse = response.trim();
    const entities = JSON.parse(cleanedResponse) as ExtractedEntities;

    console.log(
      "✅ Successfully extracted entities:",
      Object.keys(entities).length,
      "categories"
    );

    return entities;
  } catch (error) {
    console.error("❌ Entity extraction failed:", error);

    // Return empty structure if extraction fails
    return {
      medications: [],
      medical_professionals: [],
      appointments: [],
      health_conditions: [],
      symptoms: [],
      family_members: [],
      activities: [],
      locations: [],
      emotional_states: [],
      concerns_worries: [],
      positive_moments: [],
      social_interactions: [],
      daily_routine_changes: [],
      future_tasks: [],
      reminders: [],
      goals: [],
      trivia_interests: [],
      game_preferences: [],
      entertainment_requests: [],
      cognitive_activities: [],
    };
  }
}
