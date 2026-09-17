// Persistence layer built on Deno KV.
//
// Key design follows the doc's privacy principle (section 11/26/27):
// only durable, functionally necessary data is stored permanently.
// Conversation state is stored too, but with a short TTL via `expireIn`
// so idle flows self-clean instead of accumulating forever.

import type {
  AccessRequest,
  ConversationState,
  Destination,
  Post,
  ScheduledPost,
} from "./types.ts";

const kv = await Deno.openKv();

const CONVERSATION_TTL_MS = 30 * 60 * 1000; // 30 minutes of inactivity

// ---- Destinations ---------------------------------------------------------

export async function addDestination(dest: Destination): Promise<void> {
  await kv.set(["destinations", dest.id], dest);
}

export async function removeDestination(id: string): Promise<void> {
  await kv.delete(["destinations", id]);
}

export async function listDestinations(): Promise<Destination[]> {
  const out: Destination[] = [];
  for await (const entry of kv.list<Destination>({ prefix: ["destinations"] })) {
    out.push(entry.value);
  }
  return out;
}

// ---- Posts (published) -----------------------------------------------------

export async function savePost(post: Post): Promise<void> {
  await kv.set(["posts", post.id], post);
}

export async function getPost(id: string): Promise<Post | null> {
  const res = await kv.get<Post>(["posts", id]);
  return res.value;
}

// Every button gets an index entry so "change this button's URL" can find
// every post/message it appears in, across destinations, in one lookup.
export async function indexButton(buttonId: string, postId: string): Promise<void> {
  await kv.set(["button_index", buttonId, postId], true);
}

export async function findPostsForButton(buttonId: string): Promise<Post[]> {
  const posts: Post[] = [];
  for await (const entry of kv.list<boolean>({ prefix: ["button_index", buttonId] })) {
    const postId = entry.key[2] as string;
    const post = await getPost(postId);
    if (post) posts.push(post);
  }
  return posts;
}

// ---- Scheduled posts --------------------------------------------------------

export async function saveScheduledPost(sp: ScheduledPost): Promise<void> {
  await kv.set(["scheduled", sp.id], sp);
}

export async function listDuePosts(now: number): Promise<ScheduledPost[]> {
  const due: ScheduledPost[] = [];
  for await (const entry of kv.list<ScheduledPost>({ prefix: ["scheduled"] })) {
    const sp = entry.value;
    if (!sp.published && sp.publishAt <= now) due.push(sp);
  }
  return due;
}

export async function markScheduledPublished(id: string): Promise<void> {
  const res = await kv.get<ScheduledPost>(["scheduled", id]);
  if (res.value) {
    res.value.published = true;
    await kv.set(["scheduled", id], res.value);
  }
}

// ---- Access requests ---------------------------------------------------------

export async function saveAccessRequest(req: AccessRequest): Promise<void> {
  await kv.set(["access", req.userId], req);
}

export async function getAccessRequest(userId: number): Promise<AccessRequest | null> {
  const res = await kv.get<AccessRequest>(["access", userId]);
  return res.value;
}

export async function isApprovedUser(userId: number): Promise<boolean> {
  const req = await getAccessRequest(userId);
  return req?.status === "approved";
}

export async function listPendingRequests(): Promise<AccessRequest[]> {
  const out: AccessRequest[] = [];
  for await (const entry of kv.list<AccessRequest>({ prefix: ["access"] })) {
    if (entry.value.status === "pending") out.push(entry.value);
  }
  return out;
}

// ---- Conversation state (short-lived, per user) ------------------------------

export async function setConversationState(
  userId: number,
  state: ConversationState,
): Promise<void> {
  await kv.set(["conversation", userId], state, { expireIn: CONVERSATION_TTL_MS });
}

export async function getConversationState(
  userId: number,
): Promise<ConversationState | null> {
  const res = await kv.get<ConversationState>(["conversation", userId]);
  return res.value;
}

export async function clearConversationState(userId: number): Promise<void> {
  await kv.delete(["conversation", userId]);
}

export { kv };
