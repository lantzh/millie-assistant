import { PromptTemplate } from "@langchain/core/prompts";

export const entityExtractionPrompt = PromptTemplate.fromTemplate(`
    Extract important entities from this elderly care conversation. Focus on health, medical, and daily life information.

    Extract these categories:
    - medications (name, dosage, frequency)
    - medical_professionals (name, specialty, relationship)
    - appointments (type, date/time, location, doctor)
    - health_conditions (condition, severity, status)
    - symptoms (description, frequency, severity)
    - family_members (name, relationship)
    - activities (type, frequency, concerns)
    - locations (addresses, facilities, important places)
    - emotional_states (mood, intensity, triggers, duration)
    - concerns_worries (topic, severity, frequency)
    - positive_moments (achievement, joy, satisfaction, social_connection)
    - social_interactions (who, relationship, frequency, quality)
    - daily_routine_changes (what_changed, impact_on_mood, adaptation)
    - future_tasks (task, priority, help_needed, deadline)
    - reminders (reminder, frequency, importance)
    - goals (goal, timeline, progress)
    - trivia_interests (topic, difficulty, enjoyment_level)
    - game_preferences (game_type, skill_level, frequency)
    - entertainment_requests (type, mood, time_of_day)
    - cognitive_activities (activity, interest_level, challenge_preference)

    Conversation text:
    {conversation_text}

    Return ONLY valid JSON with no additional text, comments, or formatting. If no entities found, return empty arrays for each category.
    
    Example format:
    {{
        "medications": [{{"name": "Aspirin", "dosage": "81mg", "frequency": "daily"}}],
        "medical_professionals": [{{"name": "Dr. Smith", "specialty": "cardiologist", "relationship": "primary doctor"}}],
        "appointments": [{{"type": "checkup", "datetime": "2024-03-15 10:00", "location": "Main Clinic", "provider": "Dr. Jones"}}],
        "health_conditions": [],
        "symptoms": [],
        "family_members": [],
        "activities": [],
        "locations": [],
        "emotional_states": [],
        "concerns_worries": [],
        "positive_moments": [],
        "social_interactions": [],
        "daily_routine_changes": [],
        "future_tasks": [{{"task": "deposit check", "priority": "medium", "help_needed": true, "deadline": "when check arrives"}}],
        "reminders": [],
        "goals": [],
        "trivia_interests": [{{"topic": "1950s music", "difficulty": "easy", "enjoyment_level": "high"}}],
        "game_preferences": [],
        "entertainment_requests": [{{"type": "trivia", "mood": "bored", "time_of_day": "afternoon"}}],
        "cognitive_activities": []
    }}
`);
