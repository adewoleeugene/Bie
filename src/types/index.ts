// Action result type for server actions
export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string };

// Extended session type
export interface ExtendedUser {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
}
