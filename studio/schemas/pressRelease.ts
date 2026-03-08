import { defineType, defineField } from 'sanity'

export const pressRelease = defineType({
  name: 'pressRelease',
  title: 'Press Release',
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
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'category' }] }],
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published At',
      type: 'datetime',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent',
    }),
    defineField({
      name: 'contactEmail',
      title: 'Contact Email',
      type: 'string',
      validation: (Rule) => Rule.email(),
    }),
    defineField({
      name: 'mediaKit',
      title: 'Media Kit',
      description: 'PDF upload for press media kit',
      type: 'file',
      options: {
        accept: '.pdf',
      },
    }),
  ],
  preview: {
    select: { title: 'title', publishedAt: 'publishedAt', language: 'language' },
    prepare({ title, publishedAt, language }: { title: string; publishedAt: string; language: string }) {
      return {
        title,
        subtitle: `${publishedAt ? new Date(publishedAt).toLocaleDateString() : ''} [${(language || '').toUpperCase()}]`,
      }
    },
  },
})
