import { userProfile } from "@/db/schema";
import { db } from "@/db";

// TODO: Improve this.
export async function createProfile(userId: string) {
  try {
    await db.insert(userProfile).values({
      userId,
    });
  } catch {
    // let's just ignore it for now
  }
}
