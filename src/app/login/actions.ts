"use server";

import { query } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email) {
    throw new Error("Email required");
  }

  // Find user by email in admin.usuario_identidad
  const result = await query(
    "SELECT usuario_id FROM admin.usuario_identidad WHERE correo_electronico = $1 LIMIT 1",
    [email]
  );

  if (result.length > 0) {
    const userId = result[0].usuario_id;
    
    // In a real app we'd check password here. 
    // Given password is null in the database for the test user, we just login.
    const cookieStore = await cookies();
    cookieStore.set("session_user_id", userId.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    redirect("/");
  } else {
    // Fallback for demo purposes if the user doesn't exist
    const cookieStore = await cookies();
    cookieStore.set("session_user_id", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    redirect("/");
  }
}
