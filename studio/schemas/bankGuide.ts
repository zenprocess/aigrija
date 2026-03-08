import { defineType, defineField } from 'sanity'

export const bankGuide = defineType({
  name: 'bankGuide',
  title: 'Bank Guide',
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
      name: 'bankName',
      title: 'Bank Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'officialDomain',
      title: 'Official Domain',
      type: 'string',
    }),
    defineField({
      name: 'fraudPhone',
      title: 'Fraud Phone',
      description: 'Anti-fraud hotline number',
      type: 'string',
    }),
    defineField({
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
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
      name: 'body',
      title: 'Body',
      type: 'blockContent',
    }),
    defineField({
      name: 'steps',
      title: 'Steps',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'step',
          fields: [
            { name: 'title', type: 'string', title: 'Step Title', validation: (Rule) => Rule.required() },
            { name: 'description', type: 'text', title: 'Description' },
          ],
          preview: {
            select: { title: 'title', subtitle: 'description' },
          },
        },
      ],
    }),
    defineField({
      name: 'lastUpdated',
      title: 'Last Updated',
      type: 'datetime',
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'bankName' },
  },
})
