import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import {
  listJurisdictionsTool,
  listStandardSetsTool,
  getStandardSetTool,
  getStandardTool,
} from "@/lib/tools";

export const maxDuration = 60;

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "list_jurisdictions",
      "List U.S. academic-standards jurisdictions (states, organizations like Common Core/NGSS, districts, schools). Optionally filter by type or a title substring. Start here to find a jurisdiction id.",
      {
        type: z.enum(["state", "organization", "school"]).optional(),
        title_contains: z.string().optional().describe("Case-insensitive substring of the jurisdiction title, e.g. 'Arizona'"),
      },
      async (args) => {
        try {
          return ok(await listJurisdictionsTool(args));
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.tool(
      "list_standard_sets",
      "Given a jurisdiction id, list its standard sets (each is a subject × grade/course, e.g. 'Arizona Math, Grade 4'). Optionally filter by subject substring or education level ('04', 'K'). Use list_jurisdictions first to get the id.",
      {
        jurisdiction_id: z.string().describe("A 32-char jurisdiction id from list_jurisdictions"),
        subject: z.string().optional().describe("Case-insensitive subject substring, e.g. 'math'"),
        education_level: z.string().optional().describe("Zero-padded grade code: 'K','01'..'12'"),
      },
      async (args) => {
        try {
          return ok(await listStandardSetsTool(args));
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.tool(
      "get_standard_set",
      "Get one full standard set by id: metadata plus every individual standard (text + codes like 4.NF.A.1), with attribution. Get the id from list_standard_sets.",
      {
        standard_set_id: z.string().describe("Compound id like <jurisdictionId>_<documentId>_grade-04"),
      },
      async (args) => {
        try {
          return ok(await getStandardSetTool(args));
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.tool(
      "get_standard",
      "Get a single standard by its id within a standard set — its text, code, tree depth, and crosswalk links to matching standards. Requires both the standard_set_id and the standard's id.",
      {
        standard_set_id: z.string().describe("The parent standard set's compound id"),
        standard_id: z.string().describe("The standard's GUID (from get_standard_set)"),
      },
      async (args) => {
        try {
          return ok(await getStandardTool(args));
        } catch (e) {
          return fail(e);
        }
      },
    );
  },
  {},
  { basePath: "/api" },
);

export { handler as GET, handler as POST, handler as DELETE };
