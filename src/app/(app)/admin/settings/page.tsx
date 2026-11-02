import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { deleteLookupAction, saveLookupAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";
import { optionalParam, type SearchParams } from "@/lib/params";
import { getMeta } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Settings" };

const TABLE_FIELDS: Record<string, Array<[string, string]>> = {
  category: [
    ["category_name", "Name"],
    ["description", "Description"],
  ],
  location: [
    ["location_name", "Name"],
    ["building", "Building"],
    ["room", "Room"],
    ["description", "Description"],
  ],
  department: [
    ["department_name", "Name"],
    ["department_code", "Code"],
  ],
};

const TABLE_PK: Record<string, string> = {
  category: "category_id",
  location: "location_id",
  department: "department_id",
};

function LookupRow({
  table,
  record,
}: {
  table: string;
  record: Record<string, unknown>;
}) {
  const fields = TABLE_FIELDS[table];
  const pk = TABLE_PK[table];
  const id = Number(record[pk]) || 0;

  return (
    <form
      action={saveLookupAction}
      className="bar"
      style={{ marginBottom: "0.45rem" }}
    >
      <input type="hidden" name="table" value={table} />
      {id ? <input type="hidden" name="id" value={id} /> : null}

      {fields.map(([name, placeholder]) => (
        <input
          key={name}
          name={name}
          placeholder={placeholder}
          defaultValue={String(record[name] ?? "")}
          required={name.endsWith("_name")}
          style={{ flex: "1 1 150px" }}
          aria-label={`${table} ${placeholder}`}
        />
      ))}

      {table === "location" ? (
        <select
          name="location_type"
          defaultValue={String(record.location_type ?? "found_spot")}
          style={{ width: "auto" }}
          aria-label="Location type"
        >
          <option value="found_spot">Found spot</option>
          <option value="storage">Storage</option>
        </select>
      ) : null}

      <SubmitButton className="sm" pendingLabel="Saving…">
        {id ? "Save" : "Add"}
      </SubmitButton>

      {id ? (
        <button
          type="submit"
          formAction={deleteLookupAction}
          className="sm danger"
          title="Delete this entry"
        >
          Delete
        </button>
      ) : null}
    </form>
  );
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { categories, locations, departments } = await getMeta();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">
            Categories, campus locations and departments used by the forms.
          </p>
        </div>
      </div>

      <Flash err={optionalParam(sp.err)} ok={optionalParam(sp.ok)} />

      <section className="card mb2">
        <h2>Categories</h2>
        <p className="tiny">Used when posting lost and found items.</p>
        <div className="mt2">
          {categories.map((category) => (
            <LookupRow
              key={category.category_id}
              table="category"
              record={category as unknown as Record<string, unknown>}
            />
          ))}
        </div>
        <h3 className="mt2">Add a category</h3>
        <LookupRow table="category" record={{}} />
      </section>

      <section className="card mb2">
        <h2>Locations</h2>
        <p className="tiny">
          <b>Found spot</b> locations are quick-pick places. <b>Storage</b>{" "}
          locations are where items are kept (office cabinets, vaults). Finders can
          also type a free-text location, so this list is optional.
        </p>
        <div className="mt2">
          {locations.length === 0 ? (
            <p className="small muted">No locations yet — add the first one below.</p>
          ) : (
            locations.map((location) => (
              <LookupRow
                key={location.location_id}
                table="location"
                record={location as unknown as Record<string, unknown>}
              />
            ))
          )}
        </div>
        <h3 className="mt2">Add a location</h3>
        <LookupRow table="location" record={{}} />
      </section>

      <section className="card mb2">
        <h2>Departments</h2>
        <p className="tiny">Shown at registration and on the dashboard.</p>
        <div className="mt2">
          {departments.map((department) => (
            <LookupRow
              key={department.department_id}
              table="department"
              record={department as unknown as Record<string, unknown>}
            />
          ))}
        </div>
        <h3 className="mt2">Add a department</h3>
        <LookupRow table="department" record={{}} />
      </section>
    </div>
  );
}
