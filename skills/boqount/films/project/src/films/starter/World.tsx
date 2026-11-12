// The one world the camera travels through, at story time g (timeline.ts): the room in its depth layers, the plant,
// the phone, and the drop that carries the reminder from the phone's card into the soil. Drawn from g alone, so it is
// the same picture on either side of the loop.
import React from 'react';
import {mix} from '../../lib/anim';
import {Depth} from '../../kit/Camera';
import {Burst} from '../../kit/Fx';
import {Beam, Dust, Outside, Sill, Wall} from './Room';
import {Plant, WATER, leafGeom} from './Plant';
import {Drop, Phone} from './Phone';
import {FALLER, ICON_C, IMPACT} from './layout';
import {ARC, BURST, dropT, night, sun} from './timeline';

/** The drop's flight: up from the card's icon, over, and down into the soil (world px), turning along its path. */
const Flight: React.FC<{g: number}> = ({g}) => {
  const t = dropT(g);
  if (t <= 0 || t >= 1) return null;
  const x = mix(ICON_C[0], IMPACT[0], t);
  const y = mix(ICON_C[1], IMPACT[1], t) - 4 * ARC * t * (1 - t);
  const vx = IMPACT[0] - ICON_C[0];
  const vy = IMPACT[1] - ICON_C[1] - 4 * ARC * (1 - 2 * t);
  const rot = (Math.atan2(vx, -vy) * 180) / Math.PI + 180;
  return <Drop x={x} y={y} size={mix(15, 40, Math.min(1, t * 2.5))} rot={rot} color={WATER} />;
};

export const World: React.FC<{g: number}> = ({g}) => {
  const light = 1 - 0.75 * night(g);
  const s = sun(g);
  const bud = leafGeom(FALLER, 0).tip;
  return (
    <>
      <Depth z={0.3}>
        <Outside light={light} />
      </Depth>
      <Depth z={0.5}>
        <Wall light={light} />
      </Depth>
      <Depth z={0.8}>
        <Beam light={light} sun={s} />
      </Depth>
      <Sill light={light} sun={s} />
      <Phone g={g} />
      <Plant g={g} light={light} />
      <Flight g={g} />
      <Burst at={BURST} x={bud[0]} y={bud[1]} dir={-55} spread={50} power={0.4} n={30} size={16} seed="leaf" />
      <Depth z={1.25}>
        <Dust g={g} light={light} sun={s} />
      </Depth>
    </>
  );
};
