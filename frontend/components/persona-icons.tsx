import {
  Briefcase,
  Building2,
  GraduationCap,
  HandHeart,
  House,
  Landmark,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/** One icon per persona, replacing the old emoji field on `Persona`. Keyed by
 * `Persona.key` from lib/personas.ts. */
export const PERSONA_ICONS: Record<string, LucideIcon> = {
  citizen: House,
  real_estate: Building2,
  insurance: ShieldCheck,
  government: Landmark,
  ngo: HandHeart,
  business: Briefcase,
  school: GraduationCap,
};

export function getPersonaIcon(key: string): LucideIcon {
  return PERSONA_ICONS[key] ?? House;
}
