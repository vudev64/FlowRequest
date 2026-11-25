// Bộ lọc và tìm kiếm
import { Filter, Search } from "lucide-react";
import { typeMeta } from "../ManagerData";
export function FilterChips({
  filter,
  query,
  requests = [],
  onFilterChange,
  onQueryChange,
}) {
  const filterOptions = ["ALL", "LEAVE", "OT", "PURCHASE"];

  return (
    <div className="section-toolbar">
      <div className="filter-group">
        <Filter size={16} />

        <span className="filter-label">Lọc theo loại</span>

        {filterOptions.map((item) => (
          <button
            key={item}
            type="button"
            className={
              filter === item
                ? "filter-chip selected"
                : "filter-chip"
            }
            onClick={() => onFilterChange(item)}
          >
            {item === "ALL" ? "Tất cả" : typeMeta[item].label}

            {item !== "ALL" && (
              <span>
                {
                  requests.filter(
                    (request) => request.type === item
                  ).length
                }
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="search-box">
        <Search size={16} />

        <input
          aria-label="Tìm đơn"
          placeholder="Tìm tên, phòng ban, mã đơn"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
    </div>
  );
}
