import { db } from "@/db";

export const findPostCollectionById = async (id: string) => {
  return db.query.postCollection.findFirst({
    where: (postCollection, { eq }) => eq(postCollection.id, id),
  });
};
