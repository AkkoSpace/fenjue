"use client";

import { Check } from "lucide-react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AdminCollection } from "@/lib/admin/editorial-queries";
import type { AdminCollectionMembershipInput } from "@/lib/admin/actions";
import { cn } from "@/lib/utils";

export function EditorialSelector({
  collections,
  disabled,
  featurePosition,
  featureRecommendation,
  featured,
  memberships,
  onFeaturePositionChange,
  onFeatureRecommendationChange,
  onFeaturedChange,
  onMembershipsChange,
}: {
  collections: AdminCollection[];
  disabled: boolean;
  featurePosition: number;
  featureRecommendation: string;
  featured: boolean;
  memberships: AdminCollectionMembershipInput[];
  onFeaturePositionChange: (value: number) => void;
  onFeatureRecommendationChange: (value: string) => void;
  onFeaturedChange: (value: boolean) => void;
  onMembershipsChange: (value: AdminCollectionMembershipInput[]) => void;
}) {
  const selected = new Map(
    memberships.map((membership) => [membership.collectionId, membership]),
  );

  function toggle(collectionId: string) {
    if (selected.has(collectionId)) {
      onMembershipsChange(
        memberships.filter((item) => item.collectionId !== collectionId),
      );
      return;
    }
    const nextPosition = Math.max(0, ...memberships.map((item) => item.position)) + 1;
    onMembershipsChange([
      ...memberships,
      { collectionId, position: nextPosition },
    ]);
  }

  function updatePosition(collectionId: string, position: number) {
    onMembershipsChange(
      memberships.map((item) =>
        item.collectionId === collectionId ? { ...item, position } : item,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-y border-border py-4">
        <div className="flex items-center justify-between gap-5">
          <div>
            <p className="text-sm font-medium text-foreground">司录精选</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              精选是平台编辑推荐，不会改变用户的天地玄黄反馈。
            </p>
          </div>
          <Switch
            aria-label="设置为精选作品"
            checked={featured}
            disabled={disabled}
            onCheckedChange={onFeaturedChange}
          />
        </div>
        {featured ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="feature-recommendation">
                推荐语
              </label>
              <Textarea
                id="feature-recommendation"
                maxLength={160}
                onChange={(event) => onFeatureRecommendationChange(event.target.value)}
                placeholder="说明为什么值得先试，而不是重复作品标题。"
                required
                rows={3}
                value={featureRecommendation}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="feature-position">
                精选排序
              </label>
              <Input
                id="feature-position"
                max={32767}
                min={1}
                onChange={(event) => onFeaturePositionChange(Number(event.target.value))}
                required
                type="number"
                value={featurePosition}
              />
            </div>
          </div>
        ) : null}
      </div>

      <fieldset disabled={disabled}>
        <legend className="text-sm font-medium text-foreground">收录专栏</legend>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          一条作品可以进入多个专栏；数字决定它在对应专栏中的顺序。
        </p>
        {collections.length ? (
          <div className="mt-3 divide-y divide-border border-y border-border">
            {collections.map((collection) => {
              const membership = selected.get(collection.id);
              return (
                <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 py-2" key={collection.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 outline-none has-focus-visible:ring-2 has-focus-visible:ring-ring">
                    <input
                      checked={Boolean(membership)}
                      className="sr-only"
                      onChange={() => toggle(collection.id)}
                      type="checkbox"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-5 shrink-0 place-items-center border",
                        membership
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-transparent",
                      )}
                    >
                      <Check className="size-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-foreground">{collection.title}</span>
                      <span className="block text-xs text-muted-foreground">{collection.published ? "已发布" : "草稿"}</span>
                    </span>
                  </label>
                  <Input
                    aria-label={`${collection.title}中的排序`}
                    disabled={!membership || disabled}
                    max={32767}
                    min={1}
                    onChange={(event) => updatePosition(collection.id, Number(event.target.value))}
                    type="number"
                    value={membership?.position ?? 100}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 border-y border-border py-4 text-sm text-muted-foreground">
            还没有专栏。先到
            <Link className="mx-1 text-primary underline underline-offset-4" href="/admin/collections">
              专栏管理
            </Link>
            创建草稿。
          </p>
        )}
      </fieldset>
    </div>
  );
}
