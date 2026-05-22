import * as cheerio from "cheerio";
import type { UserEvent } from "#shared/types/userEvents";
import type { UserInfo } from "#shared/types/userInfo";

export function parseEnrolledEvents(html: string): UserEvent[] {
  if (
    html.includes("/memberportal/login") &&
    !html.includes("enrolled-activities-table")
  ) {
    throw createError({ statusCode: 401, statusMessage: "Session expired." });
  }

  const $ = cheerio.load(html);
  const table = $("#enrolled-activities-table");

  if (!table.length) {
    throw createError({
      statusCode: 502,
      statusMessage: "Activities table not found on Foreninglet page.",
    });
  }

  return table
    .find("tbody tr")
    .map((_, row) => {
      const cells = $(row).find("td");
      return {
        teamId: $(cells[0]).text().trim(),
        name: $(cells[1]).text().trim(),
        date: $(cells[2]).text().trim(),
      };
    })
    .get();
}

export function parseUserInfo(html: string): UserInfo {
  if (html.includes("/memberportal/login") && !html.includes("member-form")) {
    throw createError({ statusCode: 401, statusMessage: "Session expired." });
  }

  const $ = cheerio.load(html);
  const infoForm = $("#member-form");

  const userInfo: Partial<UserInfo> = {
    legalName: infoForm.find('input[name="first_name"]').attr("value")?.trim() ?? "",
    birthDate: infoForm.find('input[name="birthday"]').attr("value")?.trim() ?? "",

    // parentsName: infoForm.find('input[name=""]').attr("value")?.trim() ?? "",
    // parentsPhoneNo: infoForm.find('input[name=""]').attr("value")?.trim() ?? "",
    // parentsEmail: infoForm.find('input[name=""]').attr("value")?.trim() ?? "",
    // nickname: infoForm.find('input[name=""]').attr("value")?.trim() ?? "",

    address: infoForm.find('input[name="address"]').attr("value")?.trim() ?? "",
    postcode: infoForm.find('input[name="zip"]').attr("value")?.trim() ?? "",
    city: infoForm.find('input[name="city"]').attr("value")?.trim() ?? "",
    email: infoForm.find('input[name="email"]').attr("value")?.trim() ?? "",
    phoneNo: infoForm.find('input[name="mobile"]').attr("value")?.trim() ?? "",
    // handicap: infoForm.find('input[name=""]').attr("value")?.trim() ?? "",
    // gender: infoForm.find('input[name=""]').attr("value")?.trim() ?? "",
    specialNeeds: infoForm.find('input[name="field10"]').attr("value")?.trim() ?? "",
    pronouns: infoForm.find('input[name="field24"]').attr("value")?.trim() ?? "",
  };

  return userInfo as UserInfo;
}
