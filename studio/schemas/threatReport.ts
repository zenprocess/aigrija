import { defineType, defineField } from 'sanity'

export const threatReport = defineType({
  name: 'threatReport',
  title: 'Threat Report',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'language',
      title: 'Language',
      type: 'string',
      options: {
        list: [
          { title: 'Romanian', value: 'ro' },
          { title: 'English', value: 'en' },
          { title: 'Bulgarian', value: 'bg' },
          { title: 'Hungarian', value: 'hu' },
          { title: 'Ukrainian', value: 'uk' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'translationKey',
      title: 'Translation Key',
      type: 'string',
    }),
    defineField({
      name: 'severity',
      title: 'Severity',
      type: 'string',
      options: {
        list: [
          { title: 'Critical', value: 'critical' },
          { title: 'High', value: 'high' },
          { title: 'Medium', value: 'medium' },
          { title: 'Low', value: 'low' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'threatType',
      title: 'Threat Type',
      type: 'string',
    }),
    defineField({
      name: 'affectedEntities',
      title: 'Affected Entities',
      description: 'Bank names, brands, or organizations targeted',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'iocDomains',
      title: 'IOC Domains',
      description: 'Indicator of compromise domains',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'iocUrls',
      title: 'IOC URLs',
      description: 'Indicator of compromise URLs',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'firstSeen',
      title: 'First Seen',
      type: 'datetime',
    }),
    defineField({
      name: 'lastSeen',
      title: 'Last Seen',
      type: 'datetime',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'Active', value: 'active' },
          { title: 'Resolved', value: 'resolved' },
          { title: 'Monitoring', value: 'monitoring' },
        ],
        layout: 'radio',
      },
      initialValue: 'active',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent',
    }),
    defineField({
      name: 'recommendedActions',
      title: 'Recommended Actions',
      type: 'blockContent',
    }),
    defineField({
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'content',
      title: 'Content',
      description: 'Plain text content (used by automated publishing)',
      type: 'text',
    }),
    defineField({
      name: 'sourceUrl',
      title: 'Source URL',
      type: 'url',
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
    }),
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'category' }] }],
    }),
    defineField({
      name: 'relatedCampaign',
      title: 'Related Campaign',
      description: 'Slug of the related campaign',
      type: 'string',
    }),
  ],
  preview: {
    select: { title: 'title', severity: 'severity', status: 'status' },
    prepare({ title, severity, status }: { title: string; severity: string; status: string }) {
      return {
        title,
        subtitle: `[${(severity || '').toUpperCase()}] ${status || ''}`.trim(),
      }
    },
  },
})
