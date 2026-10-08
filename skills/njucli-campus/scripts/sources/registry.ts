import { AppError } from "../../../../src/core/errors.js";
import type { CampusSourceContract } from "../contracts.js";
import { CAMPUS_SOURCE_IDS, type CampusSource, type CampusSourceId } from "../types.js";
import { academicAffairsSource } from "./academic-affairs.js";
import { assetManagementSource } from "./asset-management.js";
import { graduateAdmissionSource } from "./graduate-admission.js";
import { graduateSchoolSource } from "./graduate-school.js";
import { itscSource } from "./itsc.js";
import { njuSource } from "./nju.js";
import { researchSource } from "./research.js";
import { youthLeagueSource } from "./youth-league.js";

const contracts = {
  nju: njuSource,
  "academic-affairs": academicAffairsSource,
  "graduate-school": graduateSchoolSource,
  "graduate-admission": graduateAdmissionSource,
  itsc: itscSource,
  "youth-league": youthLeagueSource,
  research: researchSource,
  "asset-management": assetManagementSource,
} satisfies Record<CampusSourceId, CampusSourceContract>;

export function listCampusSources(): CampusSource[] {
  return CAMPUS_SOURCE_IDS.map((key) => {
    const { id, name, origin, sections } = contracts[key];
    return { id, name, origin, sections: sections.map(({ id, name, url }) => ({ id, name, url })) };
  });
}

export function getCampusSourceContract(source: string): CampusSourceContract {
  if (!Object.hasOwn(contracts, source)) {
    throw new AppError("INVALID_INPUT", `不支持的 campus source: ${source}`, {
      details: { allowed: CAMPUS_SOURCE_IDS },
    });
  }
  return contracts[source as CampusSourceId];
}
