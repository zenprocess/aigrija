import { defineType, defineField } from 'sanity'

export const schoolModule = defineType({
  name: 'schoolModule',
  title: 'School Module',
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
      name: 'gradeLevel',
      title: 'Grade Level',
      type: 'string',
      options: {
        list: [
          { title: 'Primary (grades 1-4)', value: 'primary' },
          { title: 'Secondary (grades 5-8)', value: 'secondary' },
          { title: 'High School (grades 9-12)', value: 'highschool' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'duration',
      title: 'Duration',
      description: 'e.g. "45 min"',
      type: 'string',
    }),
    defineField({
      name: 'objectives',
      title: 'Learning Objectives',
      type: 'array',
      of: [{ type: 'string' }],
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'blockContent',
    }),
    defineField({
      name: 'exercises',
      title: 'Exercises',
      type: 'blockContent',
    }),
    defineField({
      name: 'teacherNotes',
      title: 'Teacher Notes',
      type: 'blockContent',
    }),
  ],
  preview: {
    select: { title: 'title', gradeLevel: 'gradeLevel', language: 'language' },
    prepare({ title, gradeLevel, language }: { title: string; gradeLevel: string; language: string }) {
      return {
        title,
        subtitle: `${gradeLevel || ''} [${(language || '').toUpperCase()}]`,
      }
    },
  },
})
