import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const GENDERS = ["男", "女", "保密"] as const;

// 获取当前用户的基本资料（昵称 / 性别）
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const supabase = createRouteHandlerClient({ cookies });
  const { data, error } = await supabase
    .from("profiles")
    .select("username, gender")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ username: data?.username || null, gender: data?.gender || null });
}

// 更新性别（首次进入引导 + 以后修改都走这里）
export async function PATCH(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { gender } = await req.json();
  if (!GENDERS.includes(gender)) {
    return NextResponse.json({ error: "性别取值无效" }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { error } = await supabase
    .from("profiles")
    .update({ gender })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
