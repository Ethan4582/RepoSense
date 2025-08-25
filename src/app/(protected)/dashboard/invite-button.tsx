'use client'
import React from 'react'
import { toast } from 'sonner'
import { AlertDialogHeader } from '~/components/ui/alert-dialog'
import { Button } from '~/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import useProject from '~/hooks/use-project'

const InviteButton = () => {
   const { projectId } = useProject()
    const [open, setOpen] = React.useState(false)
    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <AlertDialogHeader>
                        <DialogTitle>Invite Team Members</DialogTitle>
                    </AlertDialogHeader>
                    <p className='text-sm text-gray-500'>
                        Ask them to copy and paste this link
                    </p>
                        <Input
                           className='mt-4 text-gray-800'
                           readOnly
                           value={`${window.location.origin}/join/${projectId}`} 
                           onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/join/${projectId}`)
                              toast.success('Link copied to clipboard')
                           }}
                        />
                </DialogContent>
            </Dialog>

            <Button size="sm" onClick={() => setOpen(true)}>Invite Members </Button>
        </>
    )
}


export default InviteButton;