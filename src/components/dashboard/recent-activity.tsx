'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CarFront,
  LogIn,
  LogOut,
  CreditCard,
  AlertCircle,
  Camera
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Activity {
  id: string
  type: 'entry' | 'exit' | 'payment' | 'alert' | 'camera'
  title: string
  description: string
  time: string
  status?: 'success' | 'warning' | 'error'
}

interface RecentActivityProps {
  activities: Activity[]
}

const activityIcons = {
  entry: LogIn,
  exit: LogOut,
  payment: CreditCard,
  alert: AlertCircle,
  camera: Camera,
}

const activityColors = {
  entry: 'text-green-500 bg-green-500/10',
  exit: 'text-blue-500 bg-blue-500/10',
  payment: 'text-purple-500 bg-purple-500/10',
  alert: 'text-yellow-500 bg-yellow-500/10',
  camera: 'text-gray-500 bg-gray-500/10',
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest events from your parking lot</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = activityIcons[activity.type]
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      activityColors[activity.type]
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <span className="text-xs text-muted-foreground">
                        {activity.time}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {activity.description}
                    </p>
                  </div>
                  {activity.status && (
                    <Badge
                      variant={
                        activity.status === 'success'
                          ? 'default'
                          : activity.status === 'warning'
                          ? 'secondary'
                          : 'destructive'
                      }
                      className="shrink-0"
                    >
                      {activity.status}
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
