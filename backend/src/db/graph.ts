import { db, entities, entityRelationships } from "./index";
import { and, eq, inArray } from "drizzle-orm";

type EntityData = {
  medications?: Array<{ name: string; dosage?: string; frequency?: string }>;
  family_members?: Array<{ name: string; relationship?: string }>;
  health_conditions?: Array<{ condition: string }>;
  activities?: Array<{ type: string }>;
  future_tasks?: Array<{ task: string }>;
  reminders?: Array<{ reminder: string }>;
  goals?: Array<{ goal: string }>;
};

async function upsertEntity(
  userId: string,
  type: string,
  name: string,
  properties?: Record<string, unknown>
): Promise<{ id: number; created: boolean }> {
  const [row] = await db
    .insert(entities)
    .values({ userId, type, name, properties: properties ?? null })
    .onConflictDoNothing()
    .returning({ id: entities.id });

  if (row) return { id: row.id, created: true };

  const [existing] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(and(eq(entities.userId, userId), eq(entities.name, name), eq(entities.type, type)));

  return { id: existing.id, created: false };
}

async function upsertRelationship(
  sourceId: number,
  targetId: number,
  relationshipType: string
): Promise<boolean> {
  const result = await db
    .insert(entityRelationships)
    .values({ sourceId, targetId, relationshipType })
    .onConflictDoNothing()
    .returning({ id: entityRelationships.id });
  return result.length > 0;
}

export async function populateGraph(
  userId: string,
  entityData: EntityData
): Promise<{ entityCount: number; relCount: number }> {
  let entityCount = 0;
  let relCount = 0;
  const conditionIds = new Map<string, number>();

  for (const c of entityData.health_conditions ?? []) {
    if (!c.condition) continue;
    const { id, created } = await upsertEntity(userId, "condition", c.condition);
    if (created) entityCount++;
    conditionIds.set(c.condition.toLowerCase(), id);
  }

  for (const m of entityData.medications ?? []) {
    if (!m.name) continue;
    const props: Record<string, unknown> = {};
    if (m.dosage) props.dosage = m.dosage;
    if (m.frequency) props.frequency = m.frequency;
    const { id: medId, created } = await upsertEntity(userId, "medication", m.name, props);
    if (created) entityCount++;

    for (const [, condId] of conditionIds) {
      const relCreated = await upsertRelationship(medId, condId, "TREATS");
      if (relCreated) relCount++;
    }
  }

  for (const f of entityData.family_members ?? []) {
    if (!f.name) continue;
    const props: Record<string, unknown> = {};
    if (f.relationship) props.relationship = f.relationship;
    const { created } = await upsertEntity(userId, "person", f.name, props);
    if (created) entityCount++;
  }

  for (const a of entityData.activities ?? []) {
    if (!a.type) continue;
    const { created } = await upsertEntity(userId, "activity", a.type);
    if (created) entityCount++;
  }

  return { entityCount, relCount };
}

export async function getGraphContext(
  userId: string
): Promise<{ text: string; entityCount: number }> {
  const rows = await db
    .select()
    .from(entities)
    .where(eq(entities.userId, userId));

  if (rows.length === 0) return { text: "", entityCount: 0 };

  const entityMap = new Map(rows.map((r) => [r.id, r]));

  const userEntityIds = rows.map((r) => r.id);
  const rels = await db
    .select()
    .from(entityRelationships)
    .where(inArray(entityRelationships.sourceId, userEntityIds));

  const lines: string[] = [];

  const medications = rows.filter((r) => r.type === "medication");
  const conditions  = rows.filter((r) => r.type === "condition");
  const people      = rows.filter((r) => r.type === "person");
  const activities  = rows.filter((r) => r.type === "activity");

  if (people.length > 0) {
    const descs = people.map((p) => {
      const props = p.properties as Record<string, string> | null;
      return props?.relationship ? `${p.name} (${props.relationship})` : p.name;
    });
    lines.push(`- Family/contacts: ${descs.join(", ")}`);
  }

  if (conditions.length > 0) {
    lines.push(`- Health conditions: ${conditions.map((c) => c.name).join(", ")}`);
  }

  if (medications.length > 0) {
    const descs = medications.map((m) => {
      const props = m.properties as Record<string, string> | null;
      const parts = [m.name];
      if (props?.dosage) parts.push(props.dosage);
      if (props?.frequency) parts.push(props.frequency);
      const treats = rels
        .filter((r) => r.sourceId === m.id && r.relationshipType === "TREATS")
        .map((r) => entityMap.get(r.targetId)?.name)
        .filter(Boolean);
      if (treats.length > 0) parts.push(`(treats ${treats.join(", ")})`);
      return parts.join(" ");
    });
    lines.push(`- Medications: ${descs.join("; ")}`);
  }

  if (activities.length > 0) {
    lines.push(`- Activities: ${activities.map((a) => a.name).join(", ")}`);
  }

  return { text: lines.join("\n"), entityCount: rows.length };
}
