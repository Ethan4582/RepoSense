"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { KeyRound, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { reliableSignOut } from "~/lib/sign-out";

export function AccountMenu() {
  const router = useRouter();
  const { user } = useUser();
  const { openUserProfile, signOut } = useClerk();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="focus-visible:ring-ring rounded-full outline-none focus-visible:ring-2"
          aria-label="Open account menu"
        >
          <Avatar className="size-8">
            <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? "User"} />
            <AvatarFallback>
              {user?.firstName?.[0] ??
                user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ??
                "U"}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate text-sm font-medium">
            {user?.fullName ?? "Developer"}
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {user?.primaryEmailAddress?.emailAddress}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openUserProfile()}>
          <User />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <KeyRound />
          API keys
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => void reliableSignOut(signOut)}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
