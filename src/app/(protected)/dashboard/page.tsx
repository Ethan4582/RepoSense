"use client";
import { useUser } from "@clerk/nextjs";


export default function DashboardPage() {
   const {user} =useUser();
     return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-4xl font-bold mb-4">Dashboard</h1>
      <p className="text-lg">Welcome, {user?.firstName}!</p>  
    </div>
  );
}