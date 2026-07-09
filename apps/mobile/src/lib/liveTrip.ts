import type { RealtimeChannel } from '@supabase/supabase-js';
import type { LiveTripState } from '@bisicab/shared';
import { supabase } from './supabase';

/**
 * Yolcu tableti ile sürücü uygulaması arasında düşük gecikmeli canlı veri
 * için Supabase Realtime "broadcast" kanalı. Kanal adı bisiklet/sürücü
 * kimliğine göre belirlenir; tablet ve sürücü aynı kanala bağlanır.
 */

const EVENT = 'trip_tick';

export function liveChannelName(driverId: string): string {
  return `bisicab:live:${driverId}`;
}

/** Sürücü tarafında yayın kanalı oluşturur. */
export function createLivePublisher(driverId: string): {
  channel: RealtimeChannel;
  publish: (state: LiveTripState) => void;
  close: () => void;
} {
  const channel = supabase.channel(liveChannelName(driverId), {
    config: { broadcast: { ack: false, self: false } },
  });
  channel.subscribe();

  const publish = (state: LiveTripState) => {
    void channel.send({ type: 'broadcast', event: EVENT, payload: state });
  };

  const close = () => {
    void supabase.removeChannel(channel);
  };

  return { channel, publish, close };
}

/** Tablet tarafında yayına abone olur. */
export function subscribeLive(
  driverId: string,
  onTick: (state: LiveTripState) => void
): () => void {
  const channel = supabase
    .channel(liveChannelName(driverId), {
      config: { broadcast: { self: false } },
    })
    .on('broadcast', { event: EVENT }, (msg) => {
      onTick(msg.payload as LiveTripState);
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
