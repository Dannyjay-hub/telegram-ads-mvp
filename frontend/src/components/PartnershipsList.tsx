
import { useNavigate } from 'react-router-dom'
import { GlassCard, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Handshake } from 'lucide-react'

export function PartnershipsList() {
    const navigate = useNavigate()
    return (
        <div className="space-y-6">
            <Button variant="ghost" className="pl-0 gap-2" onClick={() => navigate((-1 as any))}>
                <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <GlassCard>
                <CardHeader>
                    <CardTitle>Active Partnerships</CardTitle>
                </CardHeader>
                <CardContent className="text-center py-10">
                    <Handshake className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                    <p className="text-muted-foreground">Direct partnership management coming soon!</p>
                </CardContent>
            </GlassCard>
        </div>
    )
}
