import { useContext } from 'react'
import { AudioContext, AudioTimeContext } from '../context/AudioContext'
import type { TrackMeta, AudioContextType } from '../context/AudioContext'

export type { TrackMeta, AudioContextType }

export const useAudioEngine = () => {
  const context = useContext(AudioContext)
  if (context === undefined) {
    throw new Error('useAudioEngine must be used within an AudioProvider')
  }
  return context
}

export const useAudioTime = () => {
  return useContext(AudioTimeContext)
}
