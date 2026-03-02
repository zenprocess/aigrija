import { defineType, defineField } from 'sanity'

export const weeklyDigest = defineType({
  name: 'weeklyDigest',
  title: 'Weekly Digest',
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
      name: 'weekNumber',
      title: 'Week Number',
      type: 'number',
      validation: (Rule) => Rule.required().min(1).max(53),
    }),
    defineField({
      name: 'year',
      title: 'Year',
      type: 'number',
      validation: (Rule) => Rule.required().min(2020),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
    }),
    defineField({
      name: 'summary',
      title: 'Summary',
      type: 'blockContent',
    }),
    defineField({
      name: 'topThreats',
      title: 'Top Threats',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'threatReport' }] }],
    }),
    defineField({
      name: 'stats',
      title: 'Statistics',
      type: 'object',
      fields: [
        {
          name: 'checksPerformed',
          title: 'Checks Performed',
          type: 'number',
        },
        {
          name: 'phishingDetected',
          title: 'Phishing Detected',
          type: 'number',
        },
        {
          name: 'newCampaigns',
          title: 'New Campaigns',
          type: 'number',
        },
      ],
    }),
  ],
  preview: {
    select: { title: 'title', weekNumber: 'weekNumber', year: 'year', language: 'language' },
    prepare({ title, weekNumber, year, language }: { title: string; weekNumber: number; year: number; language: string }) {
      return {
        title,
        subtitle: `W${weekNumber} ${year} [${(language || '').toUpperCase()}]`,
      }
    },
  },
})
