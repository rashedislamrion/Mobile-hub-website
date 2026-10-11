"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Layers, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api-client";

export interface AttributeItem {
  id: string;
  name: string;
  values: Array<{ id: string; value: string }>;
}

export interface GeneratedVariant {
  id?: string;
  sku: string;
  color?: string | null;
  quality?: string | null;
  attributes: Record<string, string>;
  buyingPrice: number;
  price: number; // selling price
  wholesalePrice: number;
  offerPrice?: number | null;
  stock: number;
}

interface VariationsGeneratorProps {
  baseSku: string;
  defaultBuyingPrice: number;
  defaultSellingPrice: number;
  defaultWholesalePrice: number;
  variants: GeneratedVariant[];
  onChange: (variants: GeneratedVariant[]) => void;
  productType?: string;
  brandName?: string;
  condition?: string;
}

export function VariationsGenerator({
  baseSku,
  defaultBuyingPrice,
  defaultSellingPrice,
  defaultWholesalePrice,
  variants,
  onChange,
  productType,
  brandName,
  condition,
}: VariationsGeneratorProps) {
  const [availableAttributes, setAvailableAttributes] = useState<AttributeItem[]>([]);
  const [selectedAttrIds, setSelectedAttrIds] = useState<string[]>([]);
  const [selectedAttrValues, setSelectedAttrValues] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        let data: any = null;
        try {
          data = await apiGet<AttributeItem[]>("/attributes");
        } catch {
          data = await apiGet<AttributeItem[]>("/products/attributes");
        }
        if (Array.isArray(data)) {
          setAvailableAttributes(data);

          // TASK 1b: On EDIT form pre-select ONLY what the saved product actually has!
          // On NEW form: NO pre-selection! No attribute ticked, no value chosen!
          if (variants && variants.length > 0) {
            const activeAttrIds = new Set<string>();
            const activeAttrValues: Record<string, Set<string>> = {};

            variants.forEach((v) => {
              if (v.attributes && typeof v.attributes === "object") {
                Object.entries(v.attributes).forEach(([attrKey, attrVal]) => {
                  if (!attrVal || attrKey === "customName") return;
                  const matched = data.find(
                    (attr: AttributeItem) =>
                      attr.name.toLowerCase() === attrKey.toLowerCase()
                  );
                  if (matched) {
                    activeAttrIds.add(matched.id);
                    if (!activeAttrValues[matched.id]) activeAttrValues[matched.id] = new Set();
                    activeAttrValues[matched.id].add(attrVal);
                  }
                });
              }
              if (v.color) {
                const colorAttr = data.find((a: AttributeItem) => a.name.toLowerCase() === "color");
                if (colorAttr) {
                  activeAttrIds.add(colorAttr.id);
                  if (!activeAttrValues[colorAttr.id]) activeAttrValues[colorAttr.id] = new Set();
                  activeAttrValues[colorAttr.id].add(v.color);
                }
              }
              if (v.quality) {
                const qAttr = data.find(
                  (a: AttributeItem) =>
                    a.name.toLowerCase() === "quality" || a.name.toLowerCase() === "grade"
                );
                if (qAttr) {
                  activeAttrIds.add(qAttr.id);
                  if (!activeAttrValues[qAttr.id]) activeAttrValues[qAttr.id] = new Set();
                  activeAttrValues[qAttr.id].add(v.quality);
                }
              }
            });

            const finalValues: Record<string, string[]> = {};
            Object.entries(activeAttrValues).forEach(([id, set]) => {
              finalValues[id] = Array.from(set);
            });

            setSelectedAttrIds(Array.from(activeAttrIds));
            setSelectedAttrValues(finalValues);
          } else {
            // NEW product form: ZERO pre-selection
            setSelectedAttrIds([]);
            setSelectedAttrValues({});
          }
        }
      } catch (err) {
        console.error("Failed to fetch attributes:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [variants]);

  // Handle attribute selection toggle
  const toggleAttribute = (attrId: string) => {
    if (selectedAttrIds.includes(attrId)) {
      setSelectedAttrIds((prev) => prev.filter((id) => id !== attrId));
      setSelectedAttrValues((prev) => {
        const next = { ...prev };
        delete next[attrId];
        return next;
      });
    } else {
      setSelectedAttrIds((prev) => [...prev, attrId]);
      // TASK 1b: User ticked an attribute - do NOT select any values automatically!
      setSelectedAttrValues((prev) => ({
        ...prev,
        [attrId]: [],
      }));
    }
  };

  // Toggle specific attribute value
  const toggleAttrValue = (attrId: string, val: string) => {
    setSelectedAttrValues((prev) => {
      const current = prev[attrId] || [];
      const next = current.includes(val)
        ? current.filter((v) => v !== val)
        : [...current, val];
      return { ...prev, [attrId]: next };
    });
  };

  // Cartesian product generator
  const generateCartesianVariants = () => {
    const activeAttrs = selectedAttrIds
      .map((id) => ({
        attr: availableAttributes.find((a) => a.id === id),
        values: selectedAttrValues[id] || [],
      }))
      .filter((item) => item.attr && item.values.length > 0);

    if (activeAttrs.length === 0) return;

    // Recursive Cartesian product
    const cartesian = (
      attrList: Array<{ attr: AttributeItem; values: string[] }>,
      index = 0,
      current: Record<string, string> = {}
    ): Array<Record<string, string>> => {
      if (index === attrList.length) {
        return [{ ...current }];
      }

      const { attr, values } = attrList[index];
      const results: Array<Record<string, string>> = [];

      for (const val of values) {
        current[attr.name] = val;
        results.push(...cartesian(attrList, index + 1, current));
      }

      return results;
    };

    const combinations = cartesian(activeAttrs as any);
    const prefix = (baseSku || "PROD").trim().toUpperCase();

    const newVariants: GeneratedVariant[] = combinations.map((combo, idx) => {
      // Find color or quality if present
      const colorKey = Object.keys(combo).find((k) => k.toLowerCase() === "color");
      const qualityKey = Object.keys(combo).find((k) => k.toLowerCase() === "quality");

      const comboParts = Object.values(combo).map((v) =>
        v.replace(/\s+/g, "").toUpperCase()
      );
      const sku = `${prefix}-${comboParts.join("-") || `V${idx + 1}`}`;

      return {
        sku,
        color: colorKey ? combo[colorKey] : null,
        quality: qualityKey ? combo[qualityKey] : null,
        attributes: combo,
        buyingPrice: defaultBuyingPrice || 0,
        price: defaultSellingPrice || 0,
        wholesalePrice: defaultWholesalePrice || 0,
        offerPrice: null,
        stock: 0,
      };
    });

    onChange(newVariants);
  };

  // Variant field updates
  const updateVariant = (index: number, field: keyof GeneratedVariant, val: any) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: val };
    onChange(updated);
  };

  const removeVariant = (index: number) => {
    const updated = variants.filter((_, i) => i !== index);
    onChange(updated);
  };

  const addManualVariant = () => {
    const prefix = (baseSku || "PROD").trim().toUpperCase();
    onChange([
      ...variants,
      {
        sku: `${prefix}-CUSTOM-${variants.length + 1}`,
        color: null,
        quality: null,
        attributes: { customName: "" },
        buyingPrice: defaultBuyingPrice || 0,
        price: defaultSellingPrice || 0,
        wholesalePrice: defaultWholesalePrice || 0,
        offerPrice: null,
        stock: 0,
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Attribute Selector Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Configure Attributes
              </h3>
              <p className="text-xs text-slate-500">
                Select attributes to use (Color, Quality, Storage, etc.) and pick the available values.
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={generateCartesianVariants}
            disabled={selectedAttrIds.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generate Combinations
          </Button>
        </div>

        {/* Available Attributes Chips */}
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-2">
            Select attributes to use:
          </label>
          <div className="flex flex-wrap gap-2">
            {availableAttributes.map((attr) => {
              const isSelected = selectedAttrIds.includes(attr.id);
              return (
                <button
                  key={attr.id}
                  type="button"
                  onClick={() => toggleAttribute(attr.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    isSelected
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {attr.name}
                  {isSelected && " ✓"}
                </button>
              );
            })}
            {availableAttributes.length === 0 && !loading && (
              <span className="text-xs text-slate-400">
                No attributes found in system.
              </span>
            )}
          </div>
        </div>

        {/* Values for each selected attribute */}
        {selectedAttrIds.length > 0 && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            {selectedAttrIds.map((attrId) => {
              const attr = availableAttributes.find((a) => a.id === attrId);
              if (!attr) return null;
              const chosenValues = selectedAttrValues[attrId] || [];

              return (
                <div key={attr.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">
                      {attr.name} values:
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {chosenValues.length} of {attr.values.length} chosen
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {attr.values.map((v) => {
                      const isChosen = chosenValues.includes(v.value);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => toggleAttrValue(attr.id, v.value)}
                          className={`px-2.5 py-1 rounded text-xs transition-colors border ${
                            isChosen
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {v.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: Generated Variations Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                Product Variations ({variants.length})
              </h3>
              <p className="text-xs text-slate-500">
                Configure specific SKU suffixes, buying, selling, wholesale, and initial branch stock.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addManualVariant}
            className="text-xs h-8 border-slate-200 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Custom Variant
          </Button>
        </div>

        {variants.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Layers className="w-9 h-9 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-600">
              Please select attributes and values first
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Choose attributes like Color and Quality above, then click &ldquo;Generate Combinations&rdquo; to build variant rows.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-2.5 px-3">Variant Specification</th>
                  <th className="py-2.5 px-3">SKU Code</th>
                  <th className="py-2.5 px-2">Buying Price (৳)</th>
                  <th className="py-2.5 px-2">Selling Price (৳)</th>
                  <th className="py-2.5 px-2">Wholesale (৳)</th>
                  <th className="py-2.5 px-2">Offer Price (৳)</th>
                  <th className="py-2.5 px-2">Stock</th>
                  <th className="py-2.5 px-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variants.map((variant, idx) => {
                  const isCustomVariant =
                    Boolean(variant.attributes?.customName !== undefined) ||
                    (!variant.color && !variant.quality && Object.keys(variant.attributes || {}).length === 0);

                  const specEntries = Object.entries(variant.attributes || {}).filter(
                    ([k]) => k !== "customName"
                  );
                  if (variant.color && !specEntries.some(([k]) => k.toLowerCase() === "color")) {
                    specEntries.unshift(["Color", variant.color]);
                  }
                  if (variant.quality && !specEntries.some(([k]) => k.toLowerCase() === "quality")) {
                    specEntries.push(["Quality", variant.quality]);
                  }

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3">
                        {isCustomVariant ? (
                          <div className="space-y-1">
                            <Input
                              type="text"
                              value={variant.attributes?.customName || ""}
                              onChange={(e) => {
                                const nextAttrs = {
                                  ...(variant.attributes || {}),
                                  customName: e.target.value,
                                };
                                updateVariant(idx, "attributes", nextAttrs);
                              }}
                              placeholder="e.g. Special Edition (Required)"
                              required
                              className="h-8 text-xs bg-white border-amber-300 focus:border-emerald-500 font-medium min-w-[190px]"
                            />
                            <span className="text-[10px] text-amber-700 font-medium block">
                              Custom Variant Spec (Required)
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5 py-0.5">
                            {specEntries.length > 0 ? (
                              specEntries.map(([k, v], sIdx) => (
                                <span
                                  key={sIdx}
                                  title={`${k}: ${v}`}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-medium border border-slate-200 cursor-default transition-colors"
                                >
                                  <span className="text-slate-400 font-normal mr-1">{k}:</span>
                                  <span className="font-semibold">{v}</span>
                                </span>
                              ))
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-xs font-semibold">
                                {variant.sku || "Standard"}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <Input
                            type="text"
                            value={variant.sku}
                            onChange={(e) => updateVariant(idx, "sku", e.target.value)}
                            className="h-8 text-xs font-mono w-28 bg-white"
                          />
                          <button
                            type="button"
                            title="Generate Code / Refresh SKU"
                            onClick={() => {
                              const prefix = (baseSku || "PROD").trim().toUpperCase();
                              const comboValues = Object.entries(variant.attributes || {})
                                .filter(([k]) => k !== "customName")
                                .map(([, v]) => v.replace(/\s+/g, "").toUpperCase());
                              const suffix =
                                comboValues.length > 0
                                  ? comboValues.join("-")
                                  : variant.attributes?.customName
                                  ? variant.attributes.customName.replace(/\s+/g, "").toUpperCase()
                                  : `V${idx + 1}`;
                              updateVariant(idx, "sku", `${prefix}-${suffix}`);
                            }}
                            className="h-8 px-1.5 text-[10px] font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors"
                          >
                            Gen
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          value={variant.buyingPrice}
                          onChange={(e) => updateVariant(idx, "buyingPrice", Number(e.target.value) || 0)}
                          className="h-8 text-xs w-24 bg-white"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          value={variant.price}
                          onChange={(e) => updateVariant(idx, "price", Number(e.target.value) || 0)}
                          className="h-8 text-xs w-24 bg-white font-medium text-emerald-700"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          value={variant.wholesalePrice}
                          onChange={(e) => updateVariant(idx, "wholesalePrice", Number(e.target.value) || 0)}
                          className="h-8 text-xs w-24 bg-white"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          value={variant.offerPrice ?? ""}
                          placeholder="—"
                          onChange={(e) => updateVariant(idx, "offerPrice", e.target.value ? Number(e.target.value) : null)}
                          className="h-8 text-xs w-24 bg-white"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          value={variant.stock}
                          onChange={(e) => updateVariant(idx, "stock", Number(e.target.value) || 0)}
                          className="h-8 text-xs w-20 bg-white"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeVariant(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Remove variant"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
