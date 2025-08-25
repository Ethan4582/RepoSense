'use client'

import React from "react";
import { api } from "~/trpc/react";


const BillingPage = () => {
    const { data: user } = api.project.getMyCredits.useQuery()
    const [creditsToBuy, setCreditsToBuy] = React.useState<number[]>([100])
    const creditsToBuyAmount = creditsToBuy[0];
    const price = (creditsToBuyAmount / 50).toFixed(2)
    return (
        <div>
            <h1 className='text-xl font-semibold'>Billing</h1>
            <div className="h-2"></div>
            <p className='text-sm text-gray-500'>
                You currently have {user?.credits} credits.
            </p>
        </div>
    )
}

export default BillingPage