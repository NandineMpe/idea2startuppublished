"use server"

import { kv } from "@vercel/kv"

export async function testKvConnection() {
  try {
    // Try to ping the KV store
    const pingResult = await kv.ping()
    console.log("KV ping result:", pingResult)

    // Try to set and get a test value
    const testKey = `test_${Date.now()}`
    const testValue = { test: true, timestamp: Date.now() }

    await kv.set(testKey, testValue)
    const retrievedValue = await kv.get(testKey)

    // Clean up the test key
    await kv.del(testKey)

    return {
      success: true,
      pingResult,
      testValue,
      retrievedValue,
      match: JSON.stringify(testValue) === JSON.stringify(retrievedValue),
    }
  } catch (error) {
    console.error("KV connection test failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function getKvInfo() {
  try {
    // Get environment variable information (redacted for security)
    const envInfo = {
      KV_URL: process.env.KV_URL ? "✓ Set" : "✗ Not set",
      KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? "✓ Set" : "✗ Not set",
      KV_REST_API_READ_ONLY_TOKEN: process.env.KV_REST_API_READ_ONLY_TOKEN ? "✓ Set" : "✗ Not set",
      KV_REST_API_URL: process.env.KV_REST_API_URL ? "✓ Set" : "✗ Not set",
      REDIS_URL: process.env.REDIS_URL ? "✓ Set" : "✗ Not set",
    }

    return {
      success: true,
      envInfo,
    }
  } catch (error) {
    console.error("Error getting KV info:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
