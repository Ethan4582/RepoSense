'use client'

import { Info } from "lucide-react";
import React from "react";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { api } from "~/trpc/react";


const BillingPage = () => {
    const { data: user } = api.project.getMyCredits.useQuery()
    const [creditsToBuy, setCreditsToBuy] = React.useState<number[]>([100])
    const creditsToBuyAmount = creditsToBuy[0];
    const price = (creditsToBuyAmount / 50).toFixed(2)

    const handleBuyCredits = async () => {
        const res = await fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credits: creditsToBuyAmount }),
        });
        const data = await res.json();
        if (data.url) {
            window.location.href = data.url;
        }
    };

    return (
        <div>
            <h1 className='text-xl font-semibold'>Billing</h1>
            <div className="h-2"></div>
            <p className='text-sm text-gray-500'>
                You currently have {user?.credits} credits.
            </p>
            <div className="h-2"></div>
            <div className=' px-4 py-2 rounded-md border border-blue-200 text-blue-700'>
                <div className="flex items-center gap-2">
                    <Info className='size-4'></Info>
                <p className="text-sm"> Each Credit allow you to index  1 file in a repository</p>
                </div>
                <p className="text-sm"> If your Project has 100 files , you need 100 credits to index it.</p>
            </div>
            <div className="h-4"></div>
            <Slider defaultValue={[100]} max={1000} min={10} step={10} onValueChange={value=>setCreditsToBuy(value)} value={creditsToBuy} />
                <div className="h-4"></div>
        <Button onClick={handleBuyCredits}>
          Buy {creditsToBuyAmount} Credits for ${price}
        </Button>

        </div>
    )
}

export default BillingPage